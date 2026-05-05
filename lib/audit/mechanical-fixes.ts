/**
 * Deterministic fix generator for rules where copy generation isn't needed —
 * the fix is a template, a config snippet, or a reformat of evidence we
 * already have. Runs synchronously inside the diagnose route so no LLM cost
 * and no async wait.
 *
 * Returns the proposed_value string for an issue, or null if the rule has no
 * mechanical fix and should be sent to an agent SOP instead.
 */

import type { Page } from "./rules";

interface IssueLike {
  rule_id: string;
  page_url: string | null;
  current_value: string | null;
  evidence: Record<string, unknown> | null;
}

export function generateMechanicalFix(
  issue: IssueLike,
  page: Page | null,
  ctx: { rootUrl: string; sitemapUrls: string[]; pages: Page[] },
): string | null {
  switch (issue.rule_id) {
    case "R001": return nonOkPageFix(issue.page_url, issue.evidence);
    case "R002": return redirectChainCollapse(issue.evidence);
    case "R003": return mixedContentFix(page);
    case "R004": return canonicalSelfTag(issue.page_url);
    case "R005": return canonicalBrokenFix(issue.page_url, issue.evidence);
    case "R006": return canonicalCrossDomainFix(issue.page_url, issue.evidence);
    case "R008": return navNoindexFix();
    case "R009": return robotsTxtTemplate(ctx.rootUrl);
    case "R010": return sitemapXmlFromPages(ctx.pages);
    case "R011": return sitemapBrokenList(issue.evidence);
    case "R012": return sitemapNoindexList(issue.evidence);
    case "R013": return httpsRedirectSnippet(ctx.rootUrl);
    case "R014": return hstsSnippet();
    case "R018": return multipleH1Fix(page);
    case "R019": return skippedHeadingFix(page);
    case "R020": return hreflangFix(page);
    case "R021": return urlCaseRedirect(issue.page_url);
    case "R022": return urlWhitespaceRedirect(issue.page_url);
    case "R035": return ogTitleTag(page);
    case "R036": return ogImageTag(ctx.rootUrl);
    case "R037": return ogImageBrokenFix(page, issue.evidence);
    case "R038": return twitterCardTag();
    case "R039": return jsonLdInvalidFix(page);
    case "R044": return allCapsHeadingFix(page);
    case "R051": return brokenLinksList(issue.evidence, "internal");
    case "R052": return brokenLinksList(issue.evidence, "external");
    case "R054": return unsafeBlankFix(page);
    case "R055": return duplicateContentFix(issue.page_url, issue.evidence);
    case "R057": return placeholderFix(issue.evidence);
    case "R058": return unsubVarFix(issue.evidence);
    case "R059": return tableHeaderTemplate();
    case "R060": return singleItemListFix();
    case "R063": return llmsTxtTemplate(ctx.rootUrl, ctx.pages);
    case "R064": return llmsFullTxtTemplate(ctx.rootUrl, ctx.pages);
    case "R073": return staleArticleRefresh(page);
    case "R074": return tocFromHeadings(page);
    default: return null;
  }
}

/** Set of rule_ids that this generator handles. Diagnose route uses this to filter. */
export const MECHANICAL_RULE_IDS = new Set<string>([
  "R001", "R002", "R003", "R004", "R005", "R006", "R008",
  "R009", "R010", "R011", "R012", "R013", "R014",
  "R018", "R019", "R020", "R021", "R022",
  "R035", "R036", "R037", "R038", "R039",
  "R044", "R051", "R052", "R054", "R055",
  "R057", "R058", "R059", "R060",
  "R063", "R064", "R073", "R074",
]);

// ─── Per-rule templates ──────────────────────────────────────────────────

function robotsTxtTemplate(rootUrl: string): string {
  let origin = rootUrl;
  try { origin = new URL(rootUrl).origin; } catch {}
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "# Block typical admin/internal paths if your site has them:",
    "# Disallow: /admin",
    "# Disallow: /wp-admin/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

function sitemapXmlFromPages(pages: Page[]): string {
  const candidates = pages.filter(
    (p) => p.status_code === 200 && p.is_indexable !== false,
  );
  // Prefer self-referencing canonicals; otherwise the URL itself
  const urls = candidates
    .map((p) => (p.canonical_self_referencing && p.canonical_url ? p.canonical_url : p.url))
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .sort();

  const xmlLines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const url of urls) {
    xmlLines.push("  <url>");
    xmlLines.push(`    <loc>${escapeXml(url)}</loc>`);
    xmlLines.push("  </url>");
  }
  xmlLines.push("</urlset>");
  xmlLines.push("");
  return xmlLines.join("\n");
}

function sitemapBrokenList(evidence: Record<string, unknown> | null): string {
  const sample = (evidence?.broken_sample as string[] | undefined) ?? [];
  const count = (evidence?.count as number | undefined) ?? sample.length;
  if (sample.length === 0) {
    return "Remove every URL from the sitemap that doesn't return HTTP 200.\n\n(The crawler captured the failures during the audit but the evidence wasn't preserved on this issue. Re-run the audit to surface the offending URLs.)";
  }
  return [
    `${count} URL${count === 1 ? "" : "s"} in your sitemap returned non-200. Remove these from sitemap.xml:`,
    "",
    ...sample.map((u) => `  - ${u}`),
    sample.length < count ? `  … and ${count - sample.length} more (re-run the audit to refresh)` : "",
  ].filter(Boolean).join("\n") + "\n";
}

function sitemapNoindexList(evidence: Record<string, unknown> | null): string {
  const sample = (evidence?.sample as string[] | undefined) ?? [];
  const count = (evidence?.count as number | undefined) ?? sample.length;
  if (sample.length === 0) return "Remove every noindex URL from your sitemap.";
  return [
    `${count} noindex page${count === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} in your sitemap. Either remove the noindex directive or remove these URLs from sitemap.xml:`,
    "",
    ...sample.map((u) => `  - ${u}`),
    sample.length < count ? `  … and ${count - sample.length} more` : "",
  ].filter(Boolean).join("\n") + "\n";
}

function httpsRedirectSnippet(rootUrl: string): string {
  let host = "yourdomain.com";
  try { host = new URL(rootUrl).hostname.replace(/^www\./, ""); } catch {}
  return [
    "Configure your web server to 301 every HTTP request to its HTTPS equivalent.",
    "",
    "── nginx ────────────────────────────────────────────────",
    `server {`,
    `  listen 80;`,
    `  server_name ${host} www.${host};`,
    `  return 301 https://${host}$request_uri;`,
    `}`,
    "",
    "── Apache (.htaccess) ───────────────────────────────────",
    "RewriteEngine On",
    "RewriteCond %{HTTPS} !=on",
    "RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]",
    "",
    "── Vercel/Netlify/Cloudflare ────────────────────────────",
    "Most managed hosts have a single-toggle 'Always use HTTPS' setting in their dashboard.",
    "",
  ].join("\n");
}

function hstsSnippet(): string {
  return [
    "Add the Strict-Transport-Security header to all responses.",
    "",
    "── header value ─────────────────────────────────────────",
    "Strict-Transport-Security: max-age=31536000; includeSubDomains",
    "",
    "── nginx ────────────────────────────────────────────────",
    'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
    "",
    "── Apache ───────────────────────────────────────────────",
    'Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"',
    "",
    "Note: only enable HSTS once HTTPS is fully working. The header is sticky in browsers — a misconfiguration can lock users out.",
    "",
  ].join("\n");
}

function urlCaseRedirect(pageUrl: string | null): string {
  if (!pageUrl) return "Move to an all-lowercase URL slug and 301 the uppercase version to it.";
  let path = pageUrl;
  try { path = new URL(pageUrl).pathname; } catch {}
  const lower = path.toLowerCase();
  return [
    `Switch this URL to all-lowercase and 301 the old version:`,
    "",
    `  Old: ${path}`,
    `  New: ${lower}`,
    "",
    "── nginx ────────────────────────────────────────────────",
    `rewrite ^${escapeRegex(path)}$ ${lower} permanent;`,
    "",
    "── Apache (.htaccess) ───────────────────────────────────",
    `Redirect 301 ${path} ${lower}`,
    "",
  ].join("\n");
}

function urlWhitespaceRedirect(pageUrl: string | null): string {
  if (!pageUrl) return "Replace spaces and special characters in the slug with hyphens, then 301 the old URL.";
  let path = pageUrl;
  try { path = new URL(pageUrl).pathname; } catch {}
  const cleaned = path
    .replace(/%20|\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_/.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-(?=\/)|(?<=\/)-/g, "")
    .toLowerCase();
  return [
    `Switch this URL to a clean hyphenated slug and 301 the old version:`,
    "",
    `  Old: ${path}`,
    `  New: ${cleaned}`,
    "",
    "── nginx ────────────────────────────────────────────────",
    `rewrite ^${escapeRegex(path)}$ ${cleaned} permanent;`,
    "",
    "── Apache (.htaccess) ───────────────────────────────────",
    `Redirect 301 ${path} ${cleaned}`,
    "",
  ].join("\n");
}

function allCapsHeadingFix(page: Page | null): string {
  const headings = (page?.headings ?? []) as Array<{ level: number; text: string }>;
  const allCaps = headings.filter((h) => {
    const letters = h.text.replace(/[^a-zA-Z]/g, "");
    return letters.length >= 4 && letters === letters.toUpperCase();
  });
  if (allCaps.length === 0) {
    return "Convert literal uppercase heading text to title case. Use CSS `text-transform: uppercase` for visual styling instead.";
  }
  const rewrites = allCaps.slice(0, 10).map((h) => {
    const titleCase = h.text
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `  H${h.level} ─ "${h.text}"\n     → "${titleCase}"`;
  });
  return [
    "Rewrite these headings to title case (use CSS for visual uppercase):",
    "",
    ...rewrites,
    "",
    "── CSS for visual styling ──────────────────────────────",
    "h1, h2, h3 { text-transform: uppercase; }",
    "",
  ].join("\n");
}

function brokenLinksList(
  evidence: Record<string, unknown> | null,
  kind: "internal" | "external",
): string {
  const broken = (evidence?.broken_links as Array<{ url: string; status: number }> | undefined) ?? [];
  if (broken.length === 0) return `Update or remove every broken ${kind} link.`;
  const sample = broken.slice(0, 25);

  if (kind === "internal") {
    // Internal: the most actionable thing is a 301 redirect snippet the user can paste.
    // We don't know the *intended* destination, so we leave a clearly-marked placeholder.
    const lines: string[] = [
      `${broken.length} broken internal link${broken.length === 1 ? "" : "s"} found on this page.`,
      "Pick one of two fixes per URL:",
      "",
      "── Option A: 301 redirect on the server (recommended) ──",
      "# nginx — paste into your server block",
    ];
    for (const b of sample) {
      const path = pathFromUrl(b.url);
      lines.push(`location = ${path} { return 301 /REPLACE-WITH-LIVE-URL; }  # was ${b.status}`);
    }
    if (broken.length > sample.length) lines.push(`# … and ${broken.length - sample.length} more`);
    lines.push("");
    lines.push("── Option B: edit this page's HTML ──");
    lines.push("Find each <a href=\"…\"> below and either change href to a live URL or delete the link entirely:");
    for (const b of sample) lines.push(`  ${b.status}  ${b.url}`);
    if (broken.length > sample.length) lines.push(`  … and ${broken.length - sample.length} more`);
    return lines.join("\n");
  }

  // External: no 301 control, so the only fix is editing the page.
  const lines: string[] = [
    `${broken.length} broken external link${broken.length === 1 ? "" : "s"} found on this page.`,
    "",
    "For each URL below — either replace with a current source, swap to https://web.archive.org/web/*/{URL}, or delete the link.",
    "",
  ];
  for (const b of sample) lines.push(`  ${b.status}  ${b.url}`);
  if (broken.length > sample.length) lines.push(`  … and ${broken.length - sample.length} more`);
  return lines.join("\n");
}

function pathFromUrl(u: string): string {
  try { return new URL(u).pathname || "/"; } catch { return u; }
}

function unsafeBlankFix(page: Page | null): string {
  const count = page?.unsafe_blank_target_count ?? 0;
  return [
    `${count > 0 ? `${count} link${count === 1 ? "" : "s"} on this page need` : "Each <a target=\"_blank\"> link needs"} \`rel="noopener noreferrer"\`.`,
    "",
    "── Find ─────────────────────────────────────────────────",
    `<a href="..." target="_blank">`,
    "",
    "── Replace with ─────────────────────────────────────────",
    `<a href="..." target="_blank" rel="noopener noreferrer">`,
    "",
    "Why: without rel=\"noopener\", the destination page can manipulate window.opener — a known phishing/tab-hijacking vector. Adding it has no UX downside.",
    "",
  ].join("\n");
}

function tableHeaderTemplate(): string {
  return [
    "Wrap the first row of every data table in a <thead> with <th> column headers:",
    "",
    "── Pattern ──────────────────────────────────────────────",
    "<table>",
    "  <thead>",
    "    <tr>",
    "      <th scope=\"col\">Column 1</th>",
    "      <th scope=\"col\">Column 2</th>",
    "      <th scope=\"col\">Column 3</th>",
    "    </tr>",
    "  </thead>",
    "  <tbody>",
    "    <tr><td>...</td><td>...</td><td>...</td></tr>",
    "  </tbody>",
    "</table>",
    "",
    "Why: <th> elements are how screen readers announce the column for each cell. Without them, tabular data is unreadable to assistive tech and weaker as a structured-data signal for search.",
    "",
  ].join("\n");
}

function singleItemListFix(): string {
  return [
    "<ul> or <ol> with a single <li> is almost always a templating leftover. Two choices:",
    "",
    "1) Expand the list to 2+ items (preferred if there's more to say).",
    "",
    "2) Convert it to a paragraph. Replace:",
    "     <ul><li>The only point</li></ul>",
    "   with:",
    "     <p>The only point.</p>",
    "",
    "If the single item is intentional (e.g. a one-step recipe), wrap it in <p> instead so the page doesn't carry an empty-feeling bullet.",
    "",
  ].join("\n");
}

// ─── New mechanical fixes (Phase A extension) ────────────────────────────

function nonOkPageFix(pageUrl: string | null, evidence: Record<string, unknown> | null): string {
  const status = (evidence?.status_code as number | undefined) ?? null;
  const path = pathOnly(pageUrl) ?? "/some-path";
  const code = status ?? "4xx/5xx";
  return [
    `This URL returns HTTP ${code}. Pick one of two fixes:`,
    "",
    "── Option A: redirect to the closest live equivalent (recommended) ──",
    "# nginx",
    `location = ${path} { return 301 /REPLACE-WITH-LIVE-URL; }`,
    "# Apache (.htaccess)",
    `Redirect 301 ${path} /REPLACE-WITH-LIVE-URL`,
    "",
    "── Option B: tell crawlers the page is intentionally gone ──",
    "# nginx",
    `location = ${path} { return 410; }`,
    "# Apache (.htaccess)",
    `Redirect 410 ${path}`,
    "",
    "Then remove or update every link pointing at this URL — the broken-internal-links rule will list them on the source pages.",
    "",
  ].join("\n");
}

function redirectChainCollapse(evidence: Record<string, unknown> | null): string {
  const hops = (evidence?.hops as Array<{ url: string; status: number }> | undefined) ?? [];
  if (hops.length < 2) return "Update each intermediate redirect to point directly at the final destination.";
  const first = hops[0]?.url;
  const last = hops[hops.length - 1]?.url;
  const firstPath = pathOnly(first) ?? first ?? "";
  return [
    `${hops.length}-hop redirect chain. Collapse it to a single 301:`,
    "",
    "── Current chain ────────────────────────────────────────",
    ...hops.map((h, i) => `  ${i + 1}. ${h.status}  ${h.url}`),
    "",
    "── Replace with one direct 301 ──────────────────────────",
    "# nginx",
    `location = ${firstPath} { return 301 ${last}; }`,
    "# Apache (.htaccess)",
    `Redirect 301 ${firstPath} ${last}`,
    "",
    "Why: every hop adds latency and bleeds link equity. Search engines collapse 3+ hops into a single 301 anyway.",
    "",
  ].join("\n");
}

function mixedContentFix(page: Page | null): string {
  const count = page?.mixed_content_count ?? 0;
  return [
    `${count} HTTP resource${count === 1 ? "" : "s"} on this HTTPS page. Browsers block these silently — they don't load.`,
    "",
    "Find each one with DevTools:",
    "  1. Open this page in Chrome/Firefox.",
    "  2. DevTools → Console. Look for 'Mixed Content' warnings.",
    "  3. DevTools → Network → Filter 'http://'. Each row is an offender.",
    "",
    "Then for each:",
    "  Find:    src=\"http://...\"   or   href=\"http://...\"",
    "  Replace: src=\"https://...\"  or   href=\"https://...\"",
    "",
    "If a vendor URL truly only serves http://, replace the asset (move the image to your CDN, swap the third-party script).",
    "",
  ].join("\n");
}

function canonicalSelfTag(pageUrl: string | null): string {
  if (!pageUrl) return 'Add `<link rel="canonical" href="…this page\'s URL…">` to <head>.';
  const stripped = stripFragment(pageUrl);
  return [
    "Add this exact tag inside <head>:",
    "",
    `  <link rel="canonical" href="${escapeAttr(stripped)}" />`,
    "",
    "A self-referential canonical tells search engines this URL is the authoritative version, which prevents query-string and trailing-slash variants from competing in search.",
    "",
  ].join("\n");
}

function canonicalBrokenFix(pageUrl: string | null, evidence: Record<string, unknown> | null): string {
  const current = (evidence?.canonical_url as string | undefined) ?? "(unknown)";
  const status = (evidence?.target_status as number | undefined) ?? "non-200";
  const replacement = pageUrl ? stripFragment(pageUrl) : "…this page's URL…";
  return [
    `The canonical points at a ${status} URL: ${current}`,
    "",
    "Replace it with a self-referential canonical (recommended unless this page is genuinely a duplicate of another live URL):",
    "",
    `  <link rel="canonical" href="${escapeAttr(replacement)}" />`,
    "",
    "If the original canonical target was right but is currently broken, fix the target page instead and leave the canonical alone.",
    "",
  ].join("\n");
}

function canonicalCrossDomainFix(pageUrl: string | null, evidence: Record<string, unknown> | null): string {
  const otherHost = (evidence?.canonical_host as string | undefined) ?? "(other domain)";
  const replacement = pageUrl ? stripFragment(pageUrl) : "…this page's URL…";
  return [
    `Canonical points at ${otherHost} — that effectively asks search engines to index that other site instead of yours.`,
    "",
    "Replace with a same-domain canonical:",
    "",
    `  <link rel="canonical" href="${escapeAttr(replacement)}" />`,
    "",
    "If you genuinely want the other domain to be canonical (syndicated content the partner published first), keep the existing tag and noindex this page.",
    "",
  ].join("\n");
}

function navNoindexFix(): string {
  return [
    "This page is in your primary nav but currently noindex. Pages that the site itself promotes should be findable in search.",
    "",
    "Find the existing meta-robots tag in <head>:",
    `  <meta name="robots" content="noindex,follow">`,
    "",
    "Replace with:",
    `  <meta name="robots" content="index,follow">`,
    "",
    "Or remove the tag entirely — index,follow is the default.",
    "",
    "If the page genuinely shouldn't be indexed, remove it from the navigation instead.",
    "",
  ].join("\n");
}

function multipleH1Fix(page: Page | null): string {
  const headings = (page?.headings ?? []) as Array<{ level: number; text: string }>;
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) return "Reduce to a single <h1> declaring the page's primary topic.";
  return [
    `${h1s.length} <h1> tags on this page. Pick one to keep (usually the most descriptive of the page's topic) and demote the rest to <h2>:`,
    "",
    ...h1s.map((h, i) => `  ${i + 1}. ${truncate(h.text, 80)}`),
    "",
    "Then in HTML:",
    "  Find:    <h1>...</h1>   (the ones to demote)",
    "  Replace: <h2>...</h2>",
    "",
    "Why: every additional H1 dilutes the page's stated topic. Search engines and screen readers expect exactly one.",
    "",
  ].join("\n");
}

function skippedHeadingFix(page: Page | null): string {
  const headings = (page?.headings ?? []) as Array<{ level: number; text: string }>;
  if (headings.length === 0) return "Renumber heading levels so they descend without gaps (H1 → H2 → H3).";
  const lines: string[] = ["Current heading sequence (look for jumps of >1 level):", ""];
  let prev = 0;
  for (const h of headings.slice(0, 25)) {
    const gap = prev !== 0 && h.level > prev + 1;
    const indent = "  ".repeat(Math.max(0, h.level - 1));
    lines.push(`${gap ? "⚠ " : "  "}${indent}H${h.level}  ${truncate(h.text, 70)}`);
    prev = h.level;
  }
  if (headings.length > 25) lines.push(`  … and ${headings.length - 25} more`);
  lines.push("");
  lines.push("Fix: at each ⚠ marker, either insert the missing intermediate heading (an H2 between an H1 and an H3) or demote the deeper one (turn H3 → H2).");
  return lines.join("\n");
}

function ogTitleTag(page: Page | null): string {
  const title = page?.title ?? "Your page title here";
  return [
    "Add this tag inside <head>:",
    "",
    `  <meta property="og:title" content="${escapeAttr(title)}" />`,
    "",
    "If you want a punchier social-sharing title (different from the SEO title), customize the content attribute.",
    "",
  ].join("\n");
}

function ogImageTag(rootUrl: string): string {
  let origin = "https://yourdomain.com";
  try { origin = new URL(rootUrl).origin; } catch {}
  return [
    "Add this tag inside <head>:",
    "",
    `  <meta property="og:image" content="${origin}/og-image.png" />`,
    "",
    "Then upload a 1200×630 PNG or JPG to that URL. The image appears whenever this page is shared on Facebook, LinkedIn, Slack, etc.",
    "",
  ].join("\n");
}

function ogImageBrokenFix(page: Page | null, evidence: Record<string, unknown> | null): string {
  const cur = (evidence?.og_image as string | undefined) ?? page?.og_image ?? "(unknown)";
  const status = (evidence?.status as number | undefined) ?? "non-200";
  return [
    `The current og:image URL returns ${status}: ${cur}`,
    "",
    "Either:",
    "  A) Upload a working image at that URL (1200×630 PNG/JPG), or",
    "  B) Update the meta tag to point at a working image:",
    "",
    `     <meta property="og:image" content="https://yourdomain.com/og-image.png" />`,
    "",
    "Until this is fixed, this page renders with no preview image when shared on Facebook/LinkedIn/Slack.",
    "",
  ].join("\n");
}

function twitterCardTag(): string {
  return [
    "Add this tag inside <head>:",
    "",
    `  <meta name="twitter:card" content="summary_large_image" />`,
    "",
    "This tells Twitter/X to use a large preview card with image when this page is shared. Make sure og:image is set (or add twitter:image directly) so Twitter has something to render.",
    "",
  ].join("\n");
}

function jsonLdInvalidFix(page: Page | null): string {
  const n = page?.schema_invalid_count ?? 0;
  return [
    `${n} <script type="application/ld+json"> block${n === 1 ? "" : "s"} on this page failed to parse as JSON.`,
    "",
    "Find each block in the page's HTML and:",
    "  1. Copy the contents into https://search.google.com/test/rich-results — it will pinpoint the exact line.",
    "  2. Common causes: trailing commas, single-quotes instead of double, unescaped quotes inside strings, missing closing brace.",
    "  3. Once it parses, also validate against schema.org's required fields for the type.",
    "",
    "Until invalid blocks parse, search engines silently ignore them — the page gets none of the rich-result eligibility the schema was added for.",
    "",
  ].join("\n");
}

function duplicateContentFix(pageUrl: string | null, evidence: Record<string, unknown> | null): string {
  const otherUrl = (evidence?.duplicate_of_url as string | undefined) ?? "(other URL)";
  const thisPath = pathOnly(pageUrl) ?? pageUrl ?? "this page";
  return [
    `This page has identical content to ${otherUrl}. Pick which is canonical, then either canonicalize this one to the other or 301 redirect.`,
    "",
    "── Option A: canonicalize this page to the other ────────",
    "Add to this page's <head>:",
    "",
    `  <link rel="canonical" href="${escapeAttr(otherUrl)}" />`,
    "",
    "Use this when both URLs need to remain reachable (e.g. /products/widget AND /shop/widget for legacy reasons).",
    "",
    "── Option B: 301 redirect this page to the other ───────",
    "# nginx",
    `location = ${thisPath} { return 301 ${otherUrl}; }`,
    "# Apache (.htaccess)",
    `Redirect 301 ${thisPath} ${otherUrl}`,
    "",
    "Use this when this URL was a mistake / typo / legacy path.",
    "",
    "Whichever you pick, the OTHER page (the canonical) needs a self-referential canonical tag too.",
    "",
  ].join("\n");
}

function placeholderFix(evidence: Record<string, unknown> | null): string {
  const matches = (evidence?.matches as string[] | undefined) ?? [];
  if (matches.length === 0) return "Replace placeholder text (lorem ipsum / TODO / 'coming soon') with final intentional copy.";
  return [
    "These placeholder strings are still on the page:",
    "",
    ...matches.map((m) => `  - "${m}"`),
    "",
    "Find each in the page source and replace with intentional copy. If the section is genuinely not ready, remove it instead — empty placeholder copy makes the page look unmaintained to both readers and search engines.",
    "",
  ].join("\n");
}

function unsubVarFix(evidence: Record<string, unknown> | null): string {
  const matches = (evidence?.matches as string[] | undefined) ?? [];
  if (matches.length === 0) return "Investigate why your templating engine left variables unrendered and fix the data flow.";
  return [
    "These template variables shipped to the live page without being substituted:",
    "",
    ...matches.map((m) => `  - ${m}`),
    "",
    "Find each in the rendered HTML and trace back to the template/component that emitted it.",
    "",
    "Common causes:",
    "  • Variable name typo in the template ({{ user.first_name }} vs {{ user.firstName }})",
    "  • Data field missing from the API response feeding the template",
    "  • Helper / component not imported, so the moustache stays literal",
    "",
    "Don't ship the page until every variable in the list resolves to real content.",
    "",
  ].join("\n");
}

function llmsTxtTemplate(rootUrl: string, pages: Page[]): string {
  let origin = "https://yourdomain.com";
  let host = "yourdomain.com";
  try {
    const u = new URL(rootUrl);
    origin = u.origin;
    host = u.hostname.replace(/^www\./, "");
  } catch {}
  const home = pages.find((p) => {
    try { return new URL(p.url).pathname === "/"; } catch { return false; }
  });
  const summary = home?.meta_description ?? home?.title ?? `Information about ${host}.`;
  const navPages = pages
    .filter((p) => p.is_nav_page && p.status_code === 200 && p.is_indexable !== false)
    .slice(0, 20);
  const lines: string[] = [
    `# ${host}`,
    "",
    `> ${summary}`,
    "",
    "## Key pages",
    "",
  ];
  if (navPages.length === 0) {
    lines.push(`- [Home](${origin}/) — main landing page`);
  } else {
    for (const p of navPages) {
      const label = p.title?.split("|")[0]?.trim() || p.url;
      lines.push(`- [${label}](${p.url})${p.meta_description ? ` — ${p.meta_description.slice(0, 100)}` : ""}`);
    }
  }
  lines.push("");
  lines.push("## About");
  lines.push("");
  lines.push("Add 1–2 paragraphs describing what this site does, who it serves, and what makes it distinct. AI assistants use this to ground their citations of your content.");
  lines.push("");
  lines.push(`Publish at ${origin}/llms.txt — same URL pattern as robots.txt.`);
  lines.push("");
  return lines.join("\n");
}

function llmsFullTxtTemplate(rootUrl: string, pages: Page[]): string {
  let origin = "https://yourdomain.com";
  try { origin = new URL(rootUrl).origin; } catch {}
  return [
    "/llms-full.txt is the long-form companion to /llms.txt — full text of every key page concatenated.",
    "",
    "Generate it server-side by:",
    "  1. List your most important pages (homepage, services, top blog posts).",
    `  2. For each, fetch the rendered text content.`,
    "  3. Concatenate with H1-style separators between pages.",
    "  4. Publish at " + origin + "/llms-full.txt",
    "",
    "── Skeleton ─────────────────────────────────────────────",
    "",
    `# ${origin}/`,
    "",
    "Full text of homepage…",
    "",
    "---",
    "",
    `# ${origin}/services/whatever`,
    "",
    "Full text of services page…",
    "",
    "---",
    "",
    `(repeat for ~${Math.min(50, pages.filter((p) => p.status_code === 200).length)} key URLs)`,
    "",
    "Why: AI assistants and retrieval systems prefer one large text file over scraping individual pages — it's the LLM-equivalent of an XML sitemap.",
    "",
  ].join("\n");
}

function hreflangFix(page: Page | null): string {
  const tags = (page?.hreflang_tags ?? []) as Array<{ lang: string; href: string }>;
  const valid = (l: string) => /^([a-z]{2,3})(-[a-zA-Z]+)?$/i.test(l) || l === "x-default";
  const bad = tags.filter((t) => !valid(t.lang));
  const lines: string[] = [];
  if (bad.length > 0) {
    lines.push("Invalid language codes (replace each with a valid ISO 639-1 code, optionally + region):");
    for (const t of bad) lines.push(`  ✗  hreflang="${t.lang}"  href="${t.href}"`);
    lines.push("");
    lines.push("Reference: en, en-US, es, es-MX, fr-CA, x-default. Two-letter language codes only.");
    lines.push("");
  }
  lines.push("Every variant must declare a reciprocal hreflang. Example pattern for a page in 3 languages:");
  lines.push("");
  lines.push('  <link rel="alternate" hreflang="en" href="https://example.com/en/page" />');
  lines.push('  <link rel="alternate" hreflang="es" href="https://example.com/es/pagina" />');
  lines.push('  <link rel="alternate" hreflang="fr" href="https://example.com/fr/page" />');
  lines.push('  <link rel="alternate" hreflang="x-default" href="https://example.com/page" />');
  lines.push("");
  lines.push("All three pages need the same set of hreflang tags. Missing reciprocal = entire group is ignored by search engines.");
  return lines.join("\n");
}

function staleArticleRefresh(page: Page | null): string {
  const today = new Date().toISOString();
  const todayDate = today.slice(0, 10);
  const published = page?.date_published ?? "(unknown)";
  const modified = page?.date_modified ?? "(none)";
  return [
    `This article was published ${published.slice(0, 10) || "long ago"}; date_modified is ${modified === "(none)" ? "missing" : modified.slice(0, 10)}.`,
    "",
    "Two parts to fix:",
    "",
    "── 1. Refresh the actual content ─────────────────────────",
    "Audit the page for outdated stats, dates, examples, screenshots, or pricing. Replace with current information. If a section is no longer relevant, delete it.",
    "",
    "── 2. Update the dateModified marker ─────────────────────",
    "Once the content is genuinely refreshed, update the schema and meta tags so search engines see the freshness.",
    "",
    "Find the Article JSON-LD block and update:",
    "",
    `  "dateModified": "${today}"`,
    "",
    "If the page also exposes meta tags:",
    "",
    `  <meta property="article:modified_time" content="${today}" />`,
    "",
    `If the article was first published before ${todayDate.slice(0, 7)}, also display "Last updated: ${todayDate}" near the byline so readers see the freshness.`,
    "",
    "Don't update dateModified without actually changing content — that's spam and search engines de-rank it.",
    "",
  ].join("\n");
}

function tocFromHeadings(page: Page | null): string {
  const headings = (page?.headings ?? []) as Array<{ level: number; text: string }>;
  const tocCandidates = headings.filter((h) => h.level === 2 || h.level === 3);
  if (tocCandidates.length === 0) {
    return "Add a jump-link table of contents with anchors to each major section heading. The page's heading structure is too sparse to auto-generate one.";
  }
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const ids = new Map<string, number>();
  const items = tocCandidates.slice(0, 30).map((h) => {
    let id = slug(h.text);
    const seen = ids.get(id) ?? 0;
    if (seen > 0) id = `${id}-${seen + 1}`;
    ids.set(slug(h.text), seen + 1);
    return { ...h, id };
  });
  const lines: string[] = [
    "Add this Table of Contents block immediately after the article intro paragraph:",
    "",
    "── HTML to insert ───────────────────────────────────────",
    '<nav class="toc" aria-label="Table of contents">',
    "  <h2>On this page</h2>",
    "  <ul>",
  ];
  for (const it of items) {
    const indent = it.level === 3 ? "    " : "  ";
    lines.push(`${indent}  <li><a href="#${it.id}">${escapeAttr(it.text)}</a></li>`);
  }
  lines.push("  </ul>");
  lines.push("</nav>");
  lines.push("");
  lines.push("── Then add an id to each matching heading ─────────────");
  for (const it of items) {
    lines.push(`  <h${it.level} id="${it.id}">${escapeAttr(it.text)}</h${it.level}>`);
  }
  lines.push("");
  lines.push("Why: a TOC bumps article completion rates and gives search engines jump-link sitelinks under the main result.");
  return lines.join("\n");
}

// Shared small helpers
function pathOnly(u: string | null | undefined): string | null {
  if (!u) return null;
  try { return new URL(u).pathname || "/"; } catch { return u; }
}

function stripFragment(u: string): string {
  try { const x = new URL(u); x.hash = ""; return x.toString(); } catch { return u; }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
