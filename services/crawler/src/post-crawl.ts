import type { ExtractedPage } from "./extractor.js";
import { normalizeUrl } from "./url.js";

export interface PostCrawlOutput extends ExtractedPage {
  internal_links_in: number;
  click_depth: number | null;
  duplicate_of_url: string | null;
  canonical_status_code: number | null;
  og_image_status: number | null;
  broken_links_out: { url: string; status: number }[];
  in_sitemap: boolean;
  is_nav_page: boolean;
}

interface PostCrawlInputs {
  pages: ExtractedPage[];
  rootUrl: string;
  sitemapUrls: string[];
  navUrls: Set<string>;
  /** A function that returns HTTP status for a given URL. Caller decides batching/sampling. */
  statusOf: (url: string) => Promise<number | null>;
}

/** Computes inbound link counts, click depth, dup detection, canonical/og-image/link statuses. */
export async function postCrawl({ pages, rootUrl, sitemapUrls, navUrls, statusOf }: PostCrawlInputs): Promise<PostCrawlOutput[]> {
  // Collapse trailing-slash duplicates (and any other normalization-equivalent URLs) BEFORE
  // anything else. Crawlee can land on both `/foo` and `/foo/` separately when the server
  // 301s one to the other; without this dedup we'd write two rows with the same content_hash
  // and the dup-content + orphan rules misfire on what is actually one page.
  const dedupByNorm = new Map<string, ExtractedPage>();
  for (const p of pages) {
    const norm = normalizeUrl(p.url);
    if (!dedupByNorm.has(norm)) {
      dedupByNorm.set(norm, { ...p, url: norm });
    }
  }
  pages = [...dedupByNorm.values()];

  const byNorm = new Map<string, ExtractedPage>();
  for (const p of pages) byNorm.set(normalizeUrl(p.url), p);

  // ---- Redirect map: every URL in any redirect chain → the final landed page.
  // A link to /old-url that 301s to /new-url should count as an inbound link to
  // /new-url, not be silently dropped because /old-url isn't in `byNorm`.
  const redirectMap = new Map<string, string>();
  for (const p of pages) {
    const finalNorm = normalizeUrl(p.url);
    for (const hop of p.redirect_chain ?? []) {
      if (hop?.url) redirectMap.set(normalizeUrl(hop.url), finalNorm);
    }
  }
  function resolveTarget(t: string): string {
    let n = normalizeUrl(t);
    // Follow redirects up to 5 hops to avoid pathological cycles.
    for (let i = 0; i < 5; i++) {
      const next = redirectMap.get(n);
      if (!next || next === n) break;
      n = next;
    }
    return n;
  }

  // ---- Inbound link counts ----
  const inboundCounts = new Map<string, number>();
  for (const p of pages) {
    for (const t of p.internal_link_targets) {
      const n = resolveTarget(t);
      inboundCounts.set(n, (inboundCounts.get(n) ?? 0) + 1);
    }
  }

  // ---- Click depth via BFS from rootUrl over the in-crawl link graph ----
  const adjacency = new Map<string, string[]>();
  for (const p of pages) {
    const norm = normalizeUrl(p.url);
    adjacency.set(norm, p.internal_link_targets.map(resolveTarget).filter((u) => byNorm.has(u)));
  }
  const depth = new Map<string, number>();
  const start = normalizeUrl(rootUrl);
  if (byNorm.has(start)) {
    depth.set(start, 0);
    const queue: string[] = [start];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const d = depth.get(cur)!;
      for (const nb of adjacency.get(cur) ?? []) {
        if (!depth.has(nb)) {
          depth.set(nb, d + 1);
          queue.push(nb);
        }
      }
    }
  }

  // ---- Duplicate content detection: identical hash across two indexable 200 pages ----
  // Iterate in URL order so the "first seen" / "duplicate of" assignment is stable
  // across reruns — otherwise the same pair may swap roles run-to-run.
  const hashToUrl = new Map<string, string>();
  const dupOf = new Map<string, string>();
  const dupOrdered = [...pages].sort((a, b) => a.url.localeCompare(b.url));
  for (const p of dupOrdered) {
    if (p.status_code !== 200 || !p.is_indexable || !p.content_hash) continue;
    const existing = hashToUrl.get(p.content_hash);
    if (existing && existing !== p.url) {
      dupOf.set(p.url, existing);
    } else if (!existing) {
      hashToUrl.set(p.content_hash, p.url);
    }
  }

  // ---- Sitemap membership ----
  const sitemapSet = new Set(sitemapUrls.map(normalizeUrl));

  // ---- Canonical / og-image / broken-link probes (sampled per page; small N for site of 5000 pages = expensive — bound it) ----
  const canonStatusCache = new Map<string, number | null>();
  const ogStatusCache = new Map<string, number | null>();

  async function probe(url: string, cache: Map<string, number | null>): Promise<number | null> {
    if (cache.has(url)) return cache.get(url) ?? null;
    const s = await statusOf(url);
    cache.set(url, s);
    return s;
  }

  const out: PostCrawlOutput[] = [];
  // Iterate pages in stable URL order so the rerun's probe sequence is identical.
  const orderedPages = [...pages].sort((a, b) => a.url.localeCompare(b.url));
  for (const p of orderedPages) {
    const norm = normalizeUrl(p.url);

    let canonStatus: number | null = null;
    if (p.canonical_url) canonStatus = await probe(p.canonical_url, canonStatusCache);

    let ogStatus: number | null = null;
    if (p.og_image) ogStatus = await probe(p.og_image, ogStatusCache);

    // Broken links: only flag a small bounded sample of distinct internal+external targets per page.
    // Sorted alphabetically so the slice is deterministic — page-level link order from the
    // extractor matches DOM order which is itself stable, but sorting guards against any
    // upstream churn (and makes the probe cache hit pattern identical across runs).
    const sortedInternal = [...p.internal_link_targets].sort();
    const sortedExternal = [...p.external_link_targets].sort();
    const linkSample = [...sortedInternal.slice(0, 50), ...sortedExternal.slice(0, 50)];
    const broken: { url: string; status: number }[] = [];
    for (const u of linkSample) {
      const s = await probe(u, canonStatusCache);
      if (s !== null && s >= 400) broken.push({ url: u, status: s });
      if (broken.length >= 25) break;
    }

    out.push({
      ...p,
      internal_links_in: inboundCounts.get(norm) ?? 0,
      click_depth: depth.get(norm) ?? null,
      duplicate_of_url: dupOf.get(p.url) ?? null,
      canonical_status_code: canonStatus,
      og_image_status: ogStatus,
      broken_links_out: broken,
      in_sitemap: sitemapSet.has(norm),
      is_nav_page: navUrls.has(norm),
    });
  }
  return out;
}

/** Default statusOf using HEAD with a short timeout. Retries once on transient
 * failure to avoid a network blip flipping a link from "broken" → "ok" run-to-run. */
export async function defaultStatusOf(url: string): Promise<number | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8_000) });
      return r.status;
    } catch {
      try {
        const r = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8_000) });
        return r.status;
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  return null;
}
