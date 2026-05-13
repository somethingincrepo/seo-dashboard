import express from "express";
import { chromium } from "playwright";
import { crawlSite, CHROME_UA } from "./crawler.js";
import type { ExtractedPage } from "./extractor.js";
import { runSiteChecks } from "./site-checks.js";
import { defaultStatusOf, postCrawl } from "./post-crawl.js";
import { setRunStatus, writePages, writeSiteData } from "./supabase.js";
import { normalizeUrl } from "./url.js";

const STEALTH_ARGS = [
  "--disable-dev-shm-usage",
  "--no-sandbox",
  `--user-agent=${CHROME_UA}`,
  "--disable-blink-features=AutomationControlled",
];

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
      args: STEALTH_ARGS,
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

  const { audit_run_id, client_id, root_url, nav_urls, concurrency } = req.body as {
    audit_run_id?: string;
    client_id?: string;
    root_url?: string;
    nav_urls?: string[];
    concurrency?: number;
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
    concurrency,
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
    browser = await chromium.launch({ headless: true, args: STEALTH_ARGS });
    const context = await browser.newContext({ userAgent: CHROME_UA });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
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

// ---------------------------------------------------------------------------
// Active pipeline registry — lets the SIGINT flush handler reach in-progress
// crawls and save partial results before the machine is recycled.
// ---------------------------------------------------------------------------
interface ActivePipeline {
  auditRunId: string;
  clientId: string;
  rootUrl: string;
  navUrls: Set<string>;
  sitemapUrls: string[];
  livePages: ExtractedPage[];
}
const activePipelines = new Map<string, ActivePipeline>();

let sigtermHandlerRegistered = false;

function ensureSigtermHandler(): void {
  if (sigtermHandlerRegistered) return;
  sigtermHandlerRegistered = true;

  // Fly sends SIGINT first (graceful stop), then SIGTERM on forced kill.
  // We handle both identically: flush every in-progress crawl's partial
  // pages to Supabase + fire diagnose, then exit.
  const flush = async (signal: string) => {
    const pipelines = [...activePipelines.values()];
    if (pipelines.length === 0) { process.exit(0); return; }

    console.log(`[crawler] ${signal} — flushing ${pipelines.length} in-progress crawl(s)`);
    await Promise.allSettled(pipelines.map((p) => flushPipeline(p, `${signal} flush`)));
    process.exit(0);
  };

  process.once("SIGINT",  () => { void flush("SIGINT");  });
  process.once("SIGTERM", () => { void flush("SIGTERM"); });
}

/** Write partial pages to Supabase and fire diagnose. Safe to call on any
 *  page count — skips if 0 pages. Uses a no-op statusOf so no extra HTTP
 *  calls are made during crash flush. */
async function flushPipeline(p: ActivePipeline, reason: string): Promise<void> {
  const { auditRunId, clientId, rootUrl, navUrls, sitemapUrls, livePages } = p;
  if (livePages.length === 0) return;

  console.log(`[crawler] ${reason}: writing ${livePages.length} pages for ${auditRunId}`);
  try {
    // Use no-op statusOf — canonical/og-image HTTP probes are skipped for
    // partial saves. The final full run will overwrite with accurate data.
    const enriched = await postCrawl({
      pages: [...livePages],
      rootUrl,
      sitemapUrls,
      navUrls,
      statusOf: async () => null,
    });
    await writePages(auditRunId, clientId, enriched);
    await setRunStatus(auditRunId, {
      status: "crawled",
      crawl_completed_at: new Date().toISOString(),
      pages_crawled: enriched.length,
    });
    if (VERCEL_URL && SHARED_TOKEN) {
      await fetch(`${VERCEL_URL}/api/audit/diagnose`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${SHARED_TOKEN}` },
        body: JSON.stringify({ audit_run_id: auditRunId }),
        signal: AbortSignal.timeout(20_000),
      }).catch((e) => console.warn(`[crawler] diagnose ping after flush failed: ${e}`));
    }
    console.log(`[crawler] ${reason}: ${enriched.length} pages saved + diagnose fired for ${auditRunId}`);
  } catch (e) {
    console.error(`[crawler] ${reason}: flush failed for ${auditRunId}:`, e);
  }
}

// How many new pages must accumulate before a checkpoint write fires.
const CHECKPOINT_BATCH = 30;

async function runFullPipeline(args: {
  auditRunId: string;
  clientId: string;
  rootUrl: string;
  navUrls: Set<string>;
  concurrency?: number;
}) {
  const { auditRunId, clientId, rootUrl, navUrls, concurrency } = args;
  const livePages: ExtractedPage[] = [];

  try {
    await setRunStatus(auditRunId, { status: "crawling", crawl_started_at: new Date().toISOString() });

    // Run site-checks first (pure HTTP, ~2–10s) so sitemap URLs can seed the
    // crawler. Without this, discovery depends solely on homepage link-following
    // and fails on JS-heavy / anti-bot-protected / sparse-nav sites.
    const site = await runSiteChecks(rootUrl);
    await writeSiteData(auditRunId, site);

    // Register this pipeline so the SIGINT flush handler can reach it.
    const pipeline: ActivePipeline = {
      auditRunId, clientId, rootUrl, navUrls,
      sitemapUrls: site.sitemap_urls, livePages,
    };
    activePipelines.set(auditRunId, pipeline);
    ensureSigtermHandler();

    // Checkpoint timer — every CHECKPOINT_BATCH new pages, write to Supabase.
    // Uses no-op statusOf so no extra HTTP calls during the crawl. Final write
    // below overwrites these rows with full postCrawl output (correct inbound
    // link counts, dup detection, canonical probes). This ensures pages survive
    // a mid-crawl machine recycle even if the full crawl never completes.
    let checkpointed = 0;
    const checkpointTimer = setInterval(async () => {
      const current = livePages.length;
      if (current - checkpointed < CHECKPOINT_BATCH) return;
      const snapshot = [...livePages];
      checkpointed = current;
      try {
        const enriched = await postCrawl({
          pages: snapshot,
          rootUrl,
          sitemapUrls: site.sitemap_urls,
          navUrls,
          statusOf: async () => null,
        });
        await writePages(auditRunId, clientId, enriched);
        await setRunStatus(auditRunId, { pages_crawled: enriched.length });
        console.log(`[crawler] checkpoint: ${enriched.length} pages written for ${auditRunId}`);
      } catch (e) {
        console.warn(`[crawler] checkpoint write failed for ${auditRunId}:`, e);
      }
    }, 15_000); // check every 15s

    try {
      const { pages } = await crawlSite({
        rootUrl, seedUrls: site.sitemap_urls, concurrency, livePages,
      });

      clearInterval(checkpointTimer);
      activePipelines.delete(auditRunId);

      // Final full postCrawl — overwrites checkpoint rows with accurate
      // inbound-link counts, dup detection, and canonical/og-image probes.
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
    } finally {
      clearInterval(checkpointTimer);
      activePipelines.delete(auditRunId);
    }
  } catch (err) {
    console.error(`[crawler] pipeline error for ${auditRunId}:`, err);
    // If we have partial pages, save them before marking failed so the
    // audit watchdog can fire diagnose against whatever was collected.
    if (livePages.length > 0) {
      await flushPipeline(
        { auditRunId, clientId, rootUrl, navUrls, sitemapUrls: [], livePages },
        "error flush",
      ).catch(() => {});
    } else {
      await setRunStatus(auditRunId, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }
  }
}

// Reddit thread proxy — fetches from PullPush.io (public archive, no IP blocking).
app.get("/reddit-thread", async (req, res) => {
  const auth = req.header("authorization") ?? "";
  if (!SHARED_TOKEN || auth !== `Bearer ${SHARED_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).json({ error: "url required" }); return; }

  const postId = (url as string).match(/\/comments\/([a-z0-9]+)\//i)?.[1];
  if (!postId) { res.status(400).json({ error: "Could not extract post ID from URL" }); return; }

  console.log(`[reddit-thread] PullPush fetch for post ${postId}`);

  type Comment = { author: string; body: string; score: number };
  function parseComments(data: Array<Record<string, unknown>>): Comment[] {
    return data
      .filter((c) => { const b = c.body as string; return b && b !== "[deleted]" && b !== "[removed]"; })
      .slice(0, 20)
      .map((c) => ({ author: (c.author as string) ?? "unknown", body: ((c.body as string) ?? "").slice(0, 500), score: (c.score as number) ?? 0 }));
  }

  try {
    // Try PullPush first
    const [postRes, commentsRes] = await Promise.all([
      fetch(`https://api.pullpush.io/reddit/search/submission/?ids=${postId}&limit=1`),
      fetch(`https://api.pullpush.io/reddit/search/comment/?link_id=${postId}&limit=25&sort=score`),
    ]);
    const postJson = await postRes.json() as { data?: Array<Record<string, unknown>> };
    const commentsJson = await commentsRes.json() as { data?: Array<Record<string, unknown>> };
    const post = postJson.data?.[0];
    const comments = parseComments(commentsJson.data ?? []);

    if (post || comments.length > 0) {
      const selftext = ((post?.selftext as string) ?? "").trim() || null;
      console.log(`[reddit-thread] PullPush: selftext=${selftext?.length ?? 0}chars comments=${comments.length}`);
      res.json({ selftext, comments, score: (post?.score as number) ?? null, num_comments: (post?.num_comments as number) ?? null });
      return;
    }

    // PullPush has no data — try Arctic Shift (covers up to ~Feb 2026)
    console.log(`[reddit-thread] PullPush empty, trying Arctic Shift`);
    const [asPostRes, asCommentsRes] = await Promise.all([
      fetch(`https://arctic-shift.photon-reddit.com/api/posts/search?url=${encodeURIComponent(url as string)}&limit=1`),
      fetch(`https://arctic-shift.photon-reddit.com/api/comments/search?link_id=${postId}&limit=25`),
    ]);
    const asPostJson = await asPostRes.json() as { data?: Array<Record<string, unknown>> };
    const asCommentsJson = await asCommentsRes.json() as { data?: Array<Record<string, unknown>> };
    const asPost = asPostJson.data?.[0];
    const asComments = parseComments(asCommentsJson.data ?? []);
    const asSelftext = ((asPost?.selftext as string) ?? "").trim() || null;

    console.log(`[reddit-thread] ArcticShift: selftext=${asSelftext?.length ?? 0}chars comments=${asComments.length}`);
    res.json({ selftext: asSelftext, comments: asComments, score: (asPost?.score as number) ?? null, num_comments: (asPost?.num_comments as number) ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[reddit-thread] error:`, msg);
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`[crawler] listening on :${PORT}`);
});
