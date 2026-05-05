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
    case "R009": return robotsTxtTemplate(ctx.rootUrl);
    case "R010": return sitemapXmlFromPages(ctx.pages);
    case "R011": return sitemapBrokenList(issue.evidence);
    case "R012": return sitemapNoindexList(issue.evidence);
    case "R013": return httpsRedirectSnippet(ctx.rootUrl);
    case "R014": return hstsSnippet();
    case "R021": return urlCaseRedirect(issue.page_url);
    case "R022": return urlWhitespaceRedirect(issue.page_url);
    case "R044": return allCapsHeadingFix(page);
    case "R051": return brokenLinksList(issue.evidence, "internal");
    case "R052": return brokenLinksList(issue.evidence, "external");
    case "R054": return unsafeBlankFix(page);
    case "R059": return tableHeaderTemplate();
    case "R060": return singleItemListFix();
    default: return null;
  }
}

/** Set of rule_ids that this generator handles. Diagnose route uses this to filter. */
export const MECHANICAL_RULE_IDS = new Set<string>([
  "R009", "R010", "R011", "R012", "R013", "R014",
  "R021", "R022", "R044", "R051", "R052", "R054", "R059", "R060",
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
