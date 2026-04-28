import express from "express";
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

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
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

app.listen(PORT, () => {
  console.log(`[crawler] listening on :${PORT}`);
});
