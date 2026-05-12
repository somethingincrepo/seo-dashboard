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

// Reddit thread scraper — navigates HTML page (not .json) to avoid API-level bot blocking.
// Extracts post body and top comments from Reddit's embedded window.___r data store.
app.get("/reddit-thread", async (req, res) => {
  const auth = req.header("authorization") ?? "";
  if (!SHARED_TOKEN || auth !== `Bearer ${SHARED_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).json({ error: "url required" }); return; }

  // Strip trailing slash — navigate to the HTML thread page
  const htmlUrl = (url as string).replace(/\/$/, "") + "/";

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    });

    // Hide navigator.webdriver so Reddit's bot detection doesn't flag us
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();
    await page.goto(htmlUrl, { waitUntil: "domcontentloaded", timeout: 25_000 });

    // Extract from Reddit's embedded data store (window.___r)
    const result = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).___r as Record<string, any> | undefined;
      if (!store) return null;

      // Post data
      const postModels: Record<string, Record<string, unknown>> = store.posts?.models ?? {};
      const postKey = Object.keys(postModels)[0];
      const post = postKey ? postModels[postKey] : null;

      // Comment data — sorted by score descending
      const commentModels: Record<string, Record<string, unknown>> = store.comments?.models ?? {};
      const comments: Array<{ author: string; body: string; score: number }> = [];
      for (const c of Object.values(commentModels)) {
        const body = (c.body as string | undefined) ?? "";
        if (!body || body === "[deleted]" || body === "[removed]") continue;
        comments.push({
          author: (c.author as string) ?? "unknown",
          body: body.slice(0, 600),
          score: (c.score as number) ?? 0,
        });
      }
      comments.sort((a, b) => b.score - a.score);

      return {
        title: (post?.title as string) ?? "",
        selftext: ((post?.selftext as string) ?? "").slice(0, 2000),
        author: (post?.author as string) ?? "",
        subreddit: (post?.subreddit as Record<string, unknown>)?.name as string ?? "",
        score: (post?.score as number) ?? 0,
        num_comments: (post?.numComments as number) ?? (post?.num_comments as number) ?? 0,
        comments: comments.slice(0, 5),
      };
    });

    if (!result) {
      res.status(500).json({ error: "Could not extract Reddit data from page" });
      return;
    }

    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`[crawler] listening on :${PORT}`);
});
