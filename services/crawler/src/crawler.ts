import { PlaywrightCrawler, Configuration } from "crawlee";
import { extract, type ExtractedPage } from "./extractor.js";
import { normalizeUrl, sameHost, rootOrigin } from "./url.js";

// Realistic Chrome UA on the Fly.io Linux host. Using the same UA everywhere
// (crawler + sitemap fetches) makes fingerprinting consistent and avoids sites
// that cross-check the browser UA against fetch headers.
export const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface CrawlOptions {
  rootUrl: string;
  maxPages?: number;
  concurrency?: number;
  pageTimeoutMs?: number;
  /** Extra seed URLs (e.g. from sitemap) to prime the crawl queue beyond rootUrl. */
  seedUrls?: string[];
}

export interface CrawlOutput {
  pages: ExtractedPage[];
}

/** Crawls a site and returns extracted page rows. Site-level checks are run separately. */
export async function crawlSite(opts: CrawlOptions): Promise<CrawlOutput> {
  const { rootUrl } = opts;
  const maxPages = opts.maxPages ?? 5000;
  // concurrency=1 by default: same URL list across reruns means same audit results.
  // Higher concurrency caused order-of-arrival drift in dup-content + inbound-link counts.
  const concurrency = opts.concurrency ?? 1;
  const pageTimeoutMs = opts.pageTimeoutMs ?? 30_000;
  const origin = rootOrigin(rootUrl);

  const pages: ExtractedPage[] = [];
  // Pre-seed `seen` with both the www and non-www form of rootUrl so that a
  // www↔non-www redirect on the homepage doesn't cause it to be enqueued and
  // crawled a second time. Without this, if rootUrl=https://example.com and
  // the server 301s to https://www.example.com, the homepage link found on
  // the rendered page resolves to https://www.example.com (not in `seen`) and
  // gets queued again — wasting one crawl slot and occasionally the Supabase
  // unique index on (audit_run_id, url).
  const seen = new Set<string>([normalizeUrl(rootUrl)]);
  const wwwVariant = toggleWww(normalizeUrl(rootUrl));
  if (wwwVariant) seen.add(wwwVariant);

  // Seed from sitemap (or any caller-provided URLs) — filter to same host and
  // pre-populate `seen` so enqueueLinks never double-queues them.
  const extraSeeds: string[] = [];
  for (const u of opts.seedUrls ?? []) {
    const norm = normalizeUrl(u);
    if (!sameHost(norm, origin)) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    extraSeeds.push(norm);
  }

  // Crawlee writes its storage to disk by default — use an isolated config so
  // concurrent crawls don't collide and so Fly volumes aren't required.
  const config = new Configuration({ persistStorage: false });

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxPages,
    maxConcurrency: concurrency,
    navigationTimeoutSecs: Math.ceil(pageTimeoutMs / 1000),
    requestHandlerTimeoutSecs: Math.ceil(pageTimeoutMs / 1000) + 10,
    headless: true,
    launchContext: {
      launchOptions: {
        args: [
          "--disable-dev-shm-usage",
          "--no-sandbox",
          // Suppress the "HeadlessChrome" substring in the default UA and the
          // AutomationControlled feature flag — both are primary signals that
          // Cloudflare, Imperva, Squarespace, and Wix use to detect bots.
          `--user-agent=${CHROME_UA}`,
          "--disable-blink-features=AutomationControlled",
        ],
      },
    },
    preNavigationHooks: [
      async ({ page }) => {
        // Remove navigator.webdriver = true (set by Chrome when launched with
        // --enable-automation or in headless mode). JS-based bot detectors
        // check this property before serving content.
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        });
      },
    ],
    async requestHandler({ request, page, response, enqueueLinks, log }) {
      const startedAt = Date.now();
      const finalUrl = request.loadedUrl ?? request.url;
      const statusCode = response?.status() ?? 0;

      // Build redirect chain from response.request().redirectedFrom() walk
      const redirectChain: { url: string; status: number }[] = [];
      let walker = response?.request();
      while (walker) {
        const from = walker.redirectedFrom();
        if (!from) break;
        redirectChain.unshift({ url: from.url(), status: 301 });
        walker = from;
      }

      // Wait for SPA hydration. networkidle settles in-flight fetches; the
      // waitForFunction guard ensures the body actually has rendered text
      // before we snapshot. Both are best-effort — a slow page still proceeds
      // with whatever has rendered so far.
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page
        .waitForFunction(
          () => !!document.body && document.body.innerText.trim().length > 0,
          { timeout: 10_000 },
        )
        .catch(() => {});

      const html = await page.content();
      const visibleText = await page.evaluate(() => document.body?.innerText ?? "");

      const responseTimeMs = Date.now() - startedAt;
      const extracted = extract({
        url: request.url,
        finalUrl,
        statusCode,
        redirectChain,
        responseTimeMs,
        html,
        visibleText,
        pageOrigin: origin,
      });

      pages.push(extracted);
      log.info(`[crawler] ${statusCode} ${finalUrl} (${pages.length} pages)`);

      // Enqueue same-domain links — "same-domain" handles www↔non-www redirects correctly
      // by using the final (post-redirect) URL's origin for filtering. "same-origin" would
      // use the original request URL's origin and miss all links if the root redirects
      // from non-www to www (or vice versa). transformRequestFunction below still enforces
      // our own sameHost check as a second pass.
      await enqueueLinks({
        strategy: "same-domain",
        transformRequestFunction: (req) => {
          const norm = normalizeUrl(req.url);
          if (!sameHost(norm, origin)) return false;
          if (seen.has(norm)) return false;
          if (pages.length >= maxPages) return false;
          seen.add(norm);
          req.url = norm;
          return req;
        },
      });
    },
    failedRequestHandler({ request, log }, err) {
      log.warning(`[crawler] failed ${request.url}: ${err.message}`);
      pages.push(failedPagePlaceholder(request.url, origin));
    },
  }, config);

  await crawler.run([rootUrl, ...extraSeeds]);

  return { pages };
}

/** Returns the www↔non-www variant of a URL, or null if it can't be computed. */
function toggleWww(url: string): string | null {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.startsWith("www.")
      ? u.hostname.slice(4)
      : `www.${u.hostname}`;
    return u.toString();
  } catch {
    return null;
  }
}

function failedPagePlaceholder(url: string, origin: string): ExtractedPage {
  return {
    url,
    status_code: 0,
    redirect_target: null,
    redirect_chain: [],
    response_time_ms: 0,
    rendered_html_size: 0,
    is_https: url.startsWith("https://"),
    mixed_content_count: 0,
    title: null,
    title_length: null,
    meta_description: null,
    meta_description_length: null,
    h1_text: null,
    h1_count: 0,
    h2_count: 0,
    h3_count: 0,
    headings: [],
    has_skipped_heading_level: false,
    canonical_url: null,
    canonical_self_referencing: false,
    is_indexable: true,
    noindex: false,
    nofollow: false,
    schema_types: [],
    schema_blocks: [],
    schema_invalid_count: 0,
    og_title: null,
    og_description: null,
    og_image: null,
    og_type: null,
    twitter_card: null,
    hreflang_tags: [],
    hreflang_invalid: false,
    internal_links_out: 0,
    external_links_out: 0,
    generic_anchor_count: 0,
    unsafe_blank_target_count: 0,
    internal_link_targets: [],
    external_link_targets: [],
    word_count: 0,
    text_to_html_ratio: 0,
    content_hash: null,
    images_count: 0,
    alt_text_missing_count: 0,
    alt_text_empty_count: 0,
    alt_text_too_long_count: 0,
    alt_text_filename_count: 0,
    alt_text_duplicate_count: 0,
    placeholder_text_found: [],
    unsubstituted_vars: [],
    has_faq_format: false,
    has_numbered_steps: false,
    has_table_without_header: false,
    has_single_item_list: false,
    date_published: null,
    date_modified: null,
    has_author: false,
    has_table_of_contents: false,
    page_type: "other",
  };
}
