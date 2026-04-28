import { XMLParser } from "fast-xml-parser";
import { rootOrigin } from "./url.js";

export interface SiteChecksResult {
  robots_txt_present: boolean;
  robots_txt_content: string | null;
  sitemap_present: boolean;
  sitemap_urls: string[];
  llms_txt_present: boolean;
  llms_full_txt_present: boolean;
  https_enforced: boolean;
  hsts_header_present: boolean;
}

export async function runSiteChecks(rootUrl: string): Promise<SiteChecksResult> {
  const origin = rootOrigin(rootUrl);

  const [robots, llms, llmsFull, httpsEnforced, hsts] = await Promise.all([
    fetchText(`${origin}/robots.txt`),
    fetchText(`${origin}/llms.txt`),
    fetchText(`${origin}/llms-full.txt`),
    checkHttpsEnforced(origin),
    checkHsts(origin),
  ]);

  const sitemapUrls = await discoverSitemap(origin, robots.body);

  return {
    robots_txt_present: robots.ok,
    robots_txt_content: robots.body,
    sitemap_present: sitemapUrls.length > 0,
    sitemap_urls: sitemapUrls,
    llms_txt_present: llms.ok,
    llms_full_txt_present: llmsFull.ok,
    https_enforced: httpsEnforced,
    hsts_header_present: hsts,
  };
}

async function fetchText(url: string): Promise<{ ok: boolean; body: string | null }> {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return { ok: false, body: null };
    const body = await r.text();
    return { ok: true, body };
  } catch {
    return { ok: false, body: null };
  }
}

async function checkHttpsEnforced(origin: string): Promise<boolean> {
  // Probe http:// version of the same origin and see whether it ends on https://
  if (!origin.startsWith("https://")) return false;
  const httpUrl = origin.replace(/^https:\/\//, "http://");
  try {
    const r = await fetch(httpUrl, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    return r.url.startsWith("https://");
  } catch {
    return false;
  }
}

async function checkHsts(origin: string): Promise<boolean> {
  try {
    const r = await fetch(origin, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    return !!r.headers.get("strict-transport-security");
  } catch {
    return false;
  }
}

async function discoverSitemap(origin: string, robotsBody: string | null): Promise<string[]> {
  const candidates = new Set<string>([
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ]);
  if (robotsBody) {
    for (const line of robotsBody.split(/\r?\n/)) {
      const m = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
      if (m) candidates.add(m[1]);
    }
  }

  const urls = new Set<string>();
  const seen = new Set<string>();
  const queue: string[] = Array.from(candidates);
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    const r = await fetchText(next);
    if (!r.ok || !r.body) continue;
    const parsed = parseSitemap(r.body);
    for (const u of parsed.urls) urls.add(u);
    for (const s of parsed.sitemaps) {
      if (!seen.has(s)) queue.push(s);
    }
    if (urls.size > 50_000) break; // safety cap
  }
  return Array.from(urls);
}

function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  let parsed: unknown;
  try { parsed = parser.parse(xml); } catch { return { urls: [], sitemaps: [] }; }

  const urls: string[] = [];
  const sitemaps: string[] = [];
  const root = (parsed as Record<string, unknown>) ?? {};

  const set = (root["urlset"] as Record<string, unknown> | undefined)?.["url"];
  const setEntries = Array.isArray(set) ? set : set ? [set] : [];
  for (const e of setEntries) {
    const loc = (e as Record<string, unknown>)?.loc;
    if (typeof loc === "string") urls.push(loc.trim());
  }

  const idx = (root["sitemapindex"] as Record<string, unknown> | undefined)?.["sitemap"];
  const idxEntries = Array.isArray(idx) ? idx : idx ? [idx] : [];
  for (const e of idxEntries) {
    const loc = (e as Record<string, unknown>)?.loc;
    if (typeof loc === "string") sitemaps.push(loc.trim());
  }

  return { urls, sitemaps };
}
