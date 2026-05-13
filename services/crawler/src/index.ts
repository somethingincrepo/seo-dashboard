import express from "express";
import { chromium } from "playwright";
import { crawlSite } from "./crawler.js";
import { runSiteChecks } from "./site-checks.js";
import { defaultStatusOf, postCrawl } from "./post-crawl.js";
import { setRunStatus, writePages, writeSiteData } from "./supabase.js";
import { normalizeUrl } from "./url.js";

const PORT = Number(process.env.PORT ?? 8080);
const SHARED_TOKEN = process.env.CRAWLER_SERVICE_TOKEN;
const VERCEL_URL = process.env.VERCEL_BASE_URL; // e.g. https://something.com

const app = express();
app.use(express.json({ limit: "1mb" }));

// Fast liveness — used by Fly's basic TCP probe.
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Deep readiness — actually spins up a Chromium and tears it back down.
// Wired to Fly's http_service.checks block in fly.toml so when Chromium
// can't launch (OOM, missing binary, broken image), the machine gets
// recycled instead of sitting in a degraded state. A dedicated mutex
// prevents readiness probes from running during an active crawl.
let probeInFlight = false;
app.get("/ready", async (_req, res) => {
  if (probeInFlight) {
    res.json({ ok: true, ts: Date.now(), skipped: "concurrent_probe" });
    return;
  }
  probeInFlight = true;
  const t0 = Date.now();
  try {
    const browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
      timeout: 30_000,
    });
    await browser.close();
    res.json({ ok: true, launch_ms: Date.now() - t0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ready] chromium launch failed after ${Date.now() - t0}ms:`, msg);
    res.status(503).json({ ok: false, error: msg, launch_ms: Date.now() - t0 });
  } finally {
    probeInFlight = false;
  }
});

app.post("/crawl", async (req, res) => {
  // Auth
  const auth = req.header("authorization") ?? "";
  if (!SHARED_TOKEN || auth !== `Bearer ${SHARED_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { audit_run_id, client_id, root_url, nav_urls } = req.body as {
    audit_run_id?: string;
    client_id?: string;
    root_url?: string;
    nav_urls?: string[];
  };
  if (!audit_run_id || !client_id || !root_url) {
    res.status(400).json({ error: "audit_run_id, client_id, root_url required" });
    return;
  }

  // Acknowledge fast — work runs in the background
  res.status(202).json({ ok: true, audit_run_id });

  void runFullPipeline({
    auditRunId: audit_run_id,
    clientId: client_id,
    rootUrl: root_url,
    navUrls: new Set((nav_urls ?? [root_url]).map(normalizeUrl)),
  }).catch((err) => {
    console.error(`[crawler] pipeline failed for ${audit_run_id}:`, err);
  });
});

// Single-page JS-rendered fetch — used by extract_page fallback for Wix/SPA sites.
// POST /fetch  { url: string }  → { html: string, status: number }
app.post("/fetch", async (req, res) => {
  const auth = req.header("authorization") ?? "";
  if (!SHARED_TOKEN || auth !== `Bearer ${SHARED_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { url } = req.body as { url?: string };
  if (!url) { res.status(400).json({ error: "url required" }); return; }

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--no-sandbox"] });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": "Mozilla/5.0 (compatible; SomethingIncBot/1.0)" });
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 25_000 });
    const status = response?.status() ?? 0;
    const html = await page.content();
    res.json({ ok: true, html, status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: msg });
  } finally {
    if (browser) await browser.close();
  }
});

async function runFullPipeline(args: {
  auditRunId: string;
  clientId: string;
  rootUrl: string;
  navUrls: Set<string>;
}) {
  const { auditRunId, clientId, rootUrl, navUrls } = args;

  try {
    await setRunStatus(auditRunId, { status: "crawling", crawl_started_at: new Date().toISOString() });

    const [{ pages }, site] = await Promise.all([
      crawlSite({ rootUrl }),
      runSiteChecks(rootUrl),
    ]);

    await writeSiteData(auditRunId, site);

    const enriched = await postCrawl({
      pages,
      rootUrl,
      sitemapUrls: site.sitemap_urls,
      navUrls,
      statusOf: defaultStatusOf,
    });

    await writePages(auditRunId, clientId, enriched);

    await setRunStatus(auditRunId, {
      status: "crawled",
      crawl_completed_at: new Date().toISOString(),
      pages_crawled: enriched.length,
    });

    // Notify diagnose endpoint
    if (VERCEL_URL && SHARED_TOKEN) {
      try {
        const resp = await fetch(`${VERCEL_URL}/api/audit/diagnose`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${SHARED_TOKEN}`,
          },
          body: JSON.stringify({ audit_run_id: auditRunId }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!resp.ok) {
          console.error(`[crawler] diagnose webhook ${resp.status}: ${await resp.text()}`);
        }
      } catch (e) {
        console.error("[crawler] diagnose webhook error:", e);
      }
    } else {
      console.warn("[crawler] VERCEL_BASE_URL or CRAWLER_SERVICE_TOKEN missing — skipping diagnose ping");
    }
  } catch (err) {
    console.error(`[crawler] pipeline error for ${auditRunId}:`, err);
    await setRunStatus(auditRunId, {
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
    }).catch(() => {});
  }
}

// Reddit thread scraper — uses Playwright on old.reddit.com (server-rendered, no JS required).
// Running on Fly.io avoids the Vercel/AWS IP blocks that Reddit enforces on .json and OAuth endpoints.
app.get("/reddit-thread", async (req, res) => {
  const auth = req.header("authorization") ?? "";
  if (!SHARED_TOKEN || auth !== `Bearer ${SHARED_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).json({ error: "url required" }); return; }

  // Force old.reddit.com — server-side rendered HTML, no SPA, stable selectors
  const oldUrl = (url as string)
    .replace("www.reddit.com", "old.reddit.com")
    .replace("new.reddit.com", "old.reddit.com")
    .replace(/\?.*$/, ""); // strip any query params

  console.log(`[reddit-thread] fetching ${oldUrl}`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "en-US",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const page = await context.newPage();

    const response = await page.goto(oldUrl, { waitUntil: "domcontentloaded", timeout: 25_000 });
    const status = response?.status() ?? 0;
    console.log(`[reddit-thread] page status ${status}`);

    if (status >= 400) {
      res.status(status).json({ error: `Reddit returned ${status}` });
      return;
    }

    // Extract post selftext (text posts only — link posts won't have this)
    const selftext = await page.$eval(
      ".expando .usertext-body .md, .expando .md",
      (el: Element) => el.textContent?.trim() || ""
    ).catch(() => "");

    // Extract comments from the page — evaluates in browser context to avoid selector leakage
    const comments = await page.evaluate(() => {
      const out: Array<{ author: string; body: string; score: number }> = [];
      const commentEls = document.querySelectorAll(".thing.comment");
      for (const el of Array.from(commentEls)) {
        if (out.length >= 10) break;
        const author = el.querySelector("a.author")?.textContent?.trim() || "unknown";
        const bodyEl = el.querySelector(".usertext-body .md");
        const body = bodyEl?.textContent?.trim() || "";
        if (!body || body === "[deleted]" || body === "[removed]") continue;
        // score is stored in title attribute of the .score span
        const scoreEl = el.querySelector(".score.unvoted, .score.dislikes, .score.likes");
        const score = parseInt(scoreEl?.getAttribute("title") || "0", 10) || 0;
        out.push({ author, body: body.slice(0, 600), score });
      }
      return out;
    }) as Array<{ author: string; body: string; score: number }>;

    console.log(`[reddit-thread] selftext=${selftext.length}chars comments=${comments.length}`);
    res.json({ selftext: selftext || null, comments, score: null, num_comments: null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[reddit-thread] error:`, msg);
    res.status(500).json({ error: msg });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`[crawler] listening on :${PORT}`);
});
