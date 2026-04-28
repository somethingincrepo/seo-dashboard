import { PlaywrightCrawler, Configuration } from "crawlee";
import { extract, type ExtractedPage } from "./extractor.js";
import { normalizeUrl, sameHost, rootOrigin } from "./url.js";

export interface CrawlOptions {
  rootUrl: string;
  maxPages?: number;
  concurrency?: number;
  pageTimeoutMs?: number;
}

export interface CrawlOutput {
  pages: ExtractedPage[];
}

/** Crawls a site and returns extracted page rows. Site-level checks are run separately. */
export async function crawlSite(opts: CrawlOptions): Promise<CrawlOutput> {
  const { rootUrl } = opts;
  const maxPages = opts.maxPages ?? 5000;
  const concurrency = opts.concurrency ?? 5;
  const pageTimeoutMs = opts.pageTimeoutMs ?? 30_000;
  const origin = rootOrigin(rootUrl);

  const pages: ExtractedPage[] = [];
  const seen = new Set<string>([normalizeUrl(rootUrl)]);

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
        args: ["--disable-dev-shm-usage", "--no-sandbox"],
      },
    },
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

      // Enqueue same-origin links — but normalize and dedupe ourselves.
      await enqueueLinks({
        strategy: "same-origin",
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

  await crawler.run([rootUrl]);

  return { pages };
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
    content_hash: "",
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
