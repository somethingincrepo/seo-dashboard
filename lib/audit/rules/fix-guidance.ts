/**
 * Per-rule "how we'll fix this" copy. Surfaced in the audit detail panel.
 *
 * Two flavors:
 *  - Mechanical: an exact, deterministic fix the system can apply (or paste
 *    into the CMS). Phrased as a directive ("Add rel=\"noopener\" to …").
 *  - Generated: needs page-specific copy that we'll write with the agent in
 *    a later phase. Phrased as a forward-looking statement ("We'll generate
 *    a {N}-character title that …").
 *
 * Add an entry here whenever a rule is added; the registry test asserts that
 * every active rule has guidance text.
 */

export const FIX_GUIDANCE: Record<string, string> = {
  // ─── Technical ──────────────────────────────────────────────────────────
  R001: "Either restore the page to a 200, redirect it to a live equivalent with a 301, or remove every link pointing to it.",
  R002: "Update each intermediate redirect to point directly at the final destination. The crawler will collapse a 3-hop chain into a single 301.",
  R003: "Replace every http:// resource on the page (img, script, link, iframe, audio, video, source) with the https:// equivalent.",
  R004: "Add `<link rel=\"canonical\" href=\"…this page's URL…\">` to the page <head>. We'll generate the exact tag in the next release.",
  R005: "Either fix the canonical URL to point at a live page, or restore the canonical target to a 200.",
  R006: "Update the canonical to a same-domain URL. A cross-domain canonical effectively asks search engines to index the other site instead.",
  R007: "Decide whether the page should be indexable or not. Either remove the noindex tag, or remove the URL from your sitemap.",
  R008: "Remove the `noindex` directive from this page's <head>. Pages in your primary nav should be findable in search.",
  R009: "Create a `/robots.txt` file at the site root. We'll generate one in the next release that includes a Sitemap directive and reasonable defaults.",
  R010: "Generate and publish an XML sitemap, then reference it from robots.txt with `Sitemap: …`. We'll wire this up in the next release.",
  R011: "Remove every URL from the sitemap that doesn't return HTTP 200. We'll generate a clean sitemap in the next release.",
  R012: "Remove every noindex URL from the sitemap. Sitemaps should list only canonical, indexable pages.",
  R013: "Configure your web server (or CDN) to 301-redirect every HTTP request to its HTTPS equivalent.",
  R014: "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to your server's response headers.",
  R015: "Profile what's making the page slow (TTFB, hydration, blocking scripts). Common wins: enable CDN caching, defer third-party scripts, ship server-rendered HTML.",
  R016: "Pages over 5s are effectively unusable on mobile. Investigate server response time and rendering pipeline; consider static-rendering or ISR if the content rarely changes.",
  R017: "Reduce inlined data, paginate long lists, and remove dead markup. Most pages should render in under 1 MB of HTML.",
  R018: "Demote the duplicate H1s to H2s, or merge them into one. There should be exactly one H1 declaring the page's topic.",
  R019: "Renumber heading levels so they descend without gaps (H1 → H2 → H3, never H1 → H3).",
  R020: "Fix the hreflang values to use valid ISO 639-1 codes and ensure every targeted variant declares a reciprocal `<link rel=\"alternate\" hreflang=\"…\">` back.",
  R021: "Move to an all-lowercase URL slug and 301 the uppercase version to it.",
  R022: "Replace spaces and special characters in the URL slug with hyphens, then 301 the old URL to the cleaned-up version.",

  // ─── On-Page ────────────────────────────────────────────────────────────
  R023: "We'll generate a 30–60 character title that names the page's primary topic and includes the target keyword. Coming in the next release.",
  R024: "We'll rewrite this title to fit within 60 characters while keeping the primary keyword in the first 50.",
  R025: "We'll expand this title to a full 30–60 characters with a descriptor or modifier that strengthens the SERP snippet.",
  R026: "We'll write a unique title for each affected page that reflects its specific content.",
  R027: "We'll replace the generic title with one that names the page's actual topic plus a brand modifier.",
  R028: "We'll write a 70–160 character meta description that summarizes the page and ends with a click-encouraging hook.",
  R029: "We'll rewrite this description to land between 70–160 characters while keeping the original hook.",
  R030: "We'll expand this description with a benefit, modifier, or call to action.",
  R031: "We'll write a unique description per affected page so they differentiate in the SERP.",
  R032: "We'll write a description distinct from the title — the SERP shows both, so duplicating wastes the second line.",
  R033: "Add a single `<h1>` to the page declaring the page's topic. The H1 should include the primary keyword.",
  R034: "We'll rewrite the H1 to name the page's specific topic instead of a generic greeting like \"Welcome\".",
  R035: "Add `<meta property=\"og:title\" content=\"…\">` to <head>. We'll generate a punchy variant of the page title.",
  R036: "Add `<meta property=\"og:image\" content=\"…\">` pointing to a 1200×630 absolute URL. We'll generate or pick the image in a later release.",
  R037: "Replace the broken og:image URL with one that returns 200. Most pages share a brand-default OG image — we'll wire that up.",
  R038: "Add `<meta name=\"twitter:card\" content=\"summary_large_image\">` to <head>.",
  R039: "Open the JSON-LD block in a validator (Google's Rich Results Test) and fix the syntax. The crawler reports it as failing JSON.parse.",
  R040: "Add an Organization JSON-LD block to the homepage with `name`, `url`, `logo`, and `sameAs`. We'll generate the block in the next release.",
  R041: "Add `alt` attributes to every content image. We'll generate descriptive alt text for each one in the next release.",
  R042: "We'll rewrite long alt texts to under 125 characters while keeping the descriptive content.",
  R043: "We'll replace filename-style alt text (e.g. `DSC_0421.jpg`) with descriptions of what's actually in the image.",
  R044: "Convert literal uppercase heading text to title-case or sentence-case. Use CSS `text-transform: uppercase` for visual styling instead.",

  // ─── Content ────────────────────────────────────────────────────────────
  R045: "Either expand the page past 300 words with substantive content, or noindex it if it's a navigational stub.",
  R046: "Pages under 100 words almost always indicate an empty template, a stub, or content that should be merged into another page. Decide which.",
  R047: "Add 2–3 contextual internal links to topically related pages. We'll suggest specific link targets in the next release.",
  R048: "Link to this page from at least one topically relevant hub or nav. Orphan pages are nearly invisible to crawlers.",
  R049: "Add 1–2 more internal links pointing to this page from related content.",
  R050: "Surface this page closer to the homepage by linking to it from a nav, hub, or top-level category page. Aim for ≤ 3 clicks.",
  R051: "Update or remove every internal link returning 4xx/5xx. We'll list the offending URLs in the issue evidence.",
  R052: "Either replace each broken outbound link with a current source, swap to an archived version, or remove it entirely.",
  R053: "We'll rewrite each generic anchor (\"click here\", \"read more\") with descriptive text that names the destination topic.",
  R054: "Add `rel=\"noopener noreferrer\"` to every `<a target=\"_blank\">` link.",
  R055: "Decide which version is canonical. Either redirect the duplicates to the canonical with 301, or set their `<link rel=\"canonical\">` to the canonical URL.",
  R056: "Add real text content to the page. A very low text-to-HTML ratio almost always indicates an empty template or a page where copy is hidden behind a click.",
  R057: "Replace the placeholder text (lorem ipsum / TODO / \"coming soon\") with final, intentional copy.",
  R058: "Investigate why the templating engine left the variable unrendered (`{{ }}`, `[ ]`, etc.) and fix the data flow so the page ships with real content.",
  R059: "Add a `<thead>` row with `<th>` column headers to every data table.",
  R060: "Either expand the list to 2+ items, or convert the single item to a paragraph.",
  R061: "Add at least one supporting image to the article. Long text-only articles tank dwell time and lose image-search visibility.",
  R062: "Audit whether this page should really link to 200+ other pages. If it's a sitemap-style index, that's fine. If not, prune to under 100 contextual links.",

  // ─── AI-GEO ─────────────────────────────────────────────────────────────
  R063: "Publish an `/llms.txt` at the site root summarizing the site's purpose and key URLs. We'll generate it in the next release.",
  R064: "Publish an `/llms-full.txt` containing the full text of every key page. We'll generate it in the next release.",
  R065: "Add `potentialAction` to the WebSite schema with a `SearchAction` pointing at your site search URL template.",
  R066: "Add at least 2 `sameAs` URLs to the Organization schema (LinkedIn, Twitter/X, Wikipedia, Crunchbase, etc.).",
  R067: "Wrap the question/answer headings on this page in `FAQPage` JSON-LD. We'll generate the schema block in the next release.",
  R068: "Wrap the numbered steps in `HowTo` JSON-LD (or `Recipe` for cooking content). We'll generate the schema block in the next release.",
  R069: "Add an `author` field to the Article schema with `@type: Person`, `name`, and ideally a `url` to a bio page.",
  R070: "Add an Article (or BlogPosting / NewsArticle) JSON-LD block with `headline`, `author`, `datePublished`, and `image`.",
  R071: "Add Product JSON-LD with `name`, `image`, `description`, `offers` (price + availability), and `aggregateRating` where reviews exist.",
  R072: "Add a LocalBusiness JSON-LD block with `name`, `address`, `telephone`, `openingHours`, and `geo` coordinates.",
  R073: "Refresh the article content where the information has dated, and update `dateModified` to a current ISO timestamp. Or noindex it if it's no longer relevant.",
  R074: "Add a jump-link table of contents anchored to the article's section headings. This both improves scannability and unlocks jump-link rich results.",
  R075: "Add `aggregateRating` (or individual `Review` entries) to the Product schema. Without it, star ratings won't appear in the SERP.",
};

/** Returns the fix guidance text for a rule, or a fallback if not yet defined. */
export function getFixGuidance(ruleId: string): string {
  return (
    FIX_GUIDANCE[ruleId] ??
    "We'll detail the specific fix steps for this rule in a future release."
  );
}
