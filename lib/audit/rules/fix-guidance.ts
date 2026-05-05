/**
 * Per-rule "how we'll fix this" copy. Two layers:
 *
 *  1) GENERIC_GUIDANCE — keyed by rule_id, used as a fallback. Phrased
 *     mechanically when the fix is deterministic, forward-looking when
 *     it requires page-specific generation.
 *  2) buildFixGuidance(rule_id, ctx) — the preferred entry point. Splices
 *     in per-issue context (page URL, current_value, evidence) to produce
 *     a sentence specific to a single issue.
 *
 * Add an entry to GENERIC_GUIDANCE whenever a rule is added.
 */

export interface FixContext {
  page_url: string | null;
  current_value: string | null;
  evidence: Record<string, unknown> | null;
}

const GENERIC_GUIDANCE: Record<string, string> = {
  // ─── Technical ──────────────────────────────────────────────────────────
  R001: "Either restore the page to a 200, redirect it to a live equivalent with a 301, or remove every link pointing to it.",
  R002: "Update each intermediate redirect to point directly at the final destination. The crawler will collapse a 3-hop chain into a single 301.",
  R003: "Replace every http:// resource on the page (img, script, link, iframe, audio, video, source) with the https:// equivalent.",
  R004: "Add `<link rel=\"canonical\" href=\"…this page's URL…\">` to the page <head>.",
  R005: "Either fix the canonical URL to point at a live page, or restore the canonical target to a 200.",
  R006: "Update the canonical to a same-domain URL. A cross-domain canonical effectively asks search engines to index the other site instead.",
  R007: "Decide whether the page should be indexable. Either remove the noindex tag, or remove the URL from your sitemap.",
  R008: "Remove the `noindex` directive from this page's <head>. Pages in your primary nav should be findable in search.",
  R009: "Create a `/robots.txt` file at the site root including a Sitemap directive and reasonable defaults.",
  R010: "Generate and publish an XML sitemap, then reference it from robots.txt with `Sitemap: …`.",
  R011: "Remove every URL from the sitemap that doesn't return HTTP 200.",
  R012: "Remove every noindex URL from the sitemap. Sitemaps should list only canonical, indexable pages.",
  R013: "Configure your web server (or CDN) to 301-redirect every HTTP request to its HTTPS equivalent.",
  R014: "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to your server's response headers.",
  R015: "Profile what's making the page slow (TTFB, hydration, blocking scripts). Common wins: enable CDN caching, defer third-party scripts, ship server-rendered HTML.",
  R016: "Pages over 5s are effectively unusable on mobile. Investigate server response time and rendering pipeline.",
  R017: "Reduce inlined data, paginate long lists, and remove dead markup. Most pages should render in under 1 MB of HTML.",
  R018: "Demote the duplicate H1s to H2s, or merge them into one. There should be exactly one H1 declaring the page's topic.",
  R019: "Renumber heading levels so they descend without gaps (H1 → H2 → H3, never H1 → H3).",
  R020: "Fix the hreflang values to use valid ISO 639-1 codes and ensure every targeted variant declares a reciprocal `<link rel=\"alternate\" hreflang=\"…\">` back.",
  R021: "Move to an all-lowercase URL slug and 301 the uppercase version to it.",
  R022: "Replace spaces and special characters in the URL slug with hyphens, then 301 the old URL to the cleaned-up version.",

  // ─── On-Page ────────────────────────────────────────────────────────────
  R023: "Add a 30–60 character title that names the page's primary topic and includes the target keyword.",
  R024: "Trim this title to under 60 characters while keeping the primary keyword in the first 50.",
  R025: "Expand this title to a full 30–60 characters with a descriptor or modifier.",
  R026: "Write a unique title for each affected page that reflects its specific content.",
  R027: "Replace the generic title with one that names the page's actual topic plus a brand modifier.",
  R028: "Write a 70–160 character meta description that summarizes the page and ends with a click-encouraging hook.",
  R029: "Trim this description to between 70–160 characters while keeping the original hook.",
  R030: "Expand this description with a benefit, modifier, or call to action.",
  R031: "Write a unique description per affected page so they differentiate in the SERP.",
  R032: "Write a description distinct from the title — the SERP shows both, so duplicating wastes the second line.",
  R033: "Add a single `<h1>` to the page declaring its primary topic. The H1 should include the page's main keyword.",
  R034: "Rewrite the H1 to name the page's specific topic instead of a generic greeting.",
  R035: "Add `<meta property=\"og:title\" content=\"…\">` to <head> — typically a punchier version of the page title.",
  R036: "Add `<meta property=\"og:image\" content=\"…\">` pointing to a 1200×630 absolute URL.",
  R037: "Replace the broken og:image URL with one that returns 200.",
  R038: "Add `<meta name=\"twitter:card\" content=\"summary_large_image\">` to <head>.",
  R039: "Open the JSON-LD block in a validator and fix the syntax. The crawler reports it as failing JSON.parse.",
  R040: "Add an Organization JSON-LD block to the homepage with `name`, `url`, `logo`, and `sameAs`.",
  R041: "Add `alt` attributes to every content image with descriptive alt text.",
  R042: "Rewrite long alt text to under 125 characters while keeping the descriptive content.",
  R043: "Replace filename-style alt text (e.g. `DSC_0421.jpg`) with descriptions of what's actually in the image.",
  R044: "Convert literal uppercase heading text to title-case or sentence-case. Use CSS `text-transform: uppercase` for visual styling.",

  // ─── Content ────────────────────────────────────────────────────────────
  R045: "Either expand the page past 300 words with substantive content, or noindex it if it's a navigational stub.",
  R046: "Pages under 100 words almost always indicate an empty template, a stub, or content that should be merged into another page.",
  R047: "Add 2–3 contextual internal links to topically related pages.",
  R048: "Link to this page from at least one topically relevant hub or nav. Orphan pages are nearly invisible to crawlers.",
  R049: "Add 1–2 more internal links pointing to this page from related content.",
  R050: "Surface this page closer to the homepage by linking to it from a nav, hub, or top-level category page. Aim for ≤ 3 clicks.",
  R051: "Update or remove every internal link returning 4xx/5xx — the offending URLs are listed under Evidence.",
  R052: "Either replace each broken outbound link with a current source, swap to an archived version, or remove it entirely.",
  R053: "Rewrite each generic anchor (\"click here\", \"read more\") with descriptive text that names the destination topic.",
  R054: "Add `rel=\"noopener noreferrer\"` to every `<a target=\"_blank\">` link.",
  R055: "Decide which version is canonical. Either redirect the duplicates to the canonical with 301, or set their `<link rel=\"canonical\">` to the canonical URL.",
  R056: "Add real text content to the page. A very low text-to-HTML ratio almost always indicates an empty template or a page where copy is hidden behind a click.",
  R057: "Replace the placeholder text (lorem ipsum / TODO / \"coming soon\") with final, intentional copy.",
  R058: "Investigate why the templating engine left the variable unrendered (`{{ }}`, `[ ]`, etc.) and fix the data flow so the page ships with real content.",
  R059: "Add a `<thead>` row with `<th>` column headers to every data table.",
  R060: "Either expand the list to 2+ items, or convert the single item to a paragraph.",
  R061: "Add at least one supporting image to the article.",
  R062: "Audit whether this page should really link to 200+ other pages. If not, prune to under 100 contextual links.",

  // ─── AI-GEO ─────────────────────────────────────────────────────────────
  R063: "Publish an `/llms.txt` at the site root summarizing the site's purpose and key URLs.",
  R064: "Publish an `/llms-full.txt` containing the full text of every key page.",
  R065: "Add `potentialAction` to the WebSite schema with a `SearchAction` pointing at your site search URL template.",
  R066: "Add at least 2 `sameAs` URLs to the Organization schema (LinkedIn, Twitter/X, Wikipedia, Crunchbase, etc.).",
  R067: "Wrap the question/answer headings on this page in `FAQPage` JSON-LD.",
  R068: "Wrap the numbered steps on this page in `HowTo` JSON-LD so search engines can render them as a step-by-step rich result.",
  R069: "Add an `author` field to the Article schema with `@type: Person`, `name`, and a URL to a bio page.",
  R070: "Add an Article (or BlogPosting / NewsArticle) JSON-LD block with `headline`, `author`, `datePublished`, and `image`.",
  R071: "Add Product JSON-LD with `name`, `image`, `description`, `offers` (price + availability), and `aggregateRating` where reviews exist.",
  R072: "Add a LocalBusiness JSON-LD block with `name`, `address`, `telephone`, `openingHours`, and `geo` coordinates.",
  R073: "Refresh the article content where the information has dated, and update `dateModified` to a current ISO timestamp. Or noindex it if it's no longer relevant.",
  R074: "Add a jump-link table of contents anchored to the article's section headings.",
  R075: "Add `aggregateRating` (or individual `Review` entries) to the Product schema.",
};

/** Backwards-compat alias used by older callers. Returns generic per-rule text. */
export const FIX_GUIDANCE = GENERIC_GUIDANCE;
export function getFixGuidance(rule_id: string): string {
  return GENERIC_GUIDANCE[rule_id] ?? "We'll detail the specific fix steps for this rule in a future release.";
}

/** Returns a per-issue, page-aware fix instruction. */
export function buildFixGuidance(rule_id: string, ctx: FixContext): string {
  const path = pathOf(ctx.page_url);
  const generic = GENERIC_GUIDANCE[rule_id];

  switch (rule_id) {
    case "R023":
      return `${path ? `${path} has no title tag. ` : ""}Add a 30–60 character title that names the page's primary topic and includes its target keyword.`;
    case "R024": {
      const len = (ctx.evidence?.title_length as number | undefined) ?? null;
      return `${path ? `Title on ${path} ` : "This title "}is ${len ? len + " chars" : "over 60 chars"} — trim to 30–60 chars while keeping the primary keyword in the first 50.${ctx.current_value ? ` Current: "${truncate(stripPrefix(ctx.current_value), 90)}"` : ""}`;
    }
    case "R025": {
      const len = (ctx.evidence?.title_length as number | undefined) ?? null;
      return `${path ? `Title on ${path} ` : "This title "}is only ${len ? len + " chars" : "under 30 chars"} — expand to 30–60 chars with a descriptor or modifier.${ctx.current_value ? ` Current: "${truncate(stripPrefix(ctx.current_value), 90)}"` : ""}`;
    }
    case "R026": {
      const dups = (ctx.evidence?.duplicate_urls as string[] | undefined) ?? [];
      return `${path ? `${path} shares its title ` : "This title is shared "}with ${dups.length} other page${dups.length === 1 ? "" : "s"}. Rewrite each affected page's title to reflect its specific content.`;
    }
    case "R027":
      return `${path ? `${path} uses a generic title (${ctx.current_value ?? "?"}). ` : ""}Replace it with a title that names the page's actual topic plus a brand modifier.`;
    case "R028":
      return `${path ? `${path} has no meta description. ` : ""}Write a 70–160 character description that summarizes the page and ends with a click-encouraging hook.`;
    case "R029": {
      const len = (ctx.evidence?.meta_description_length as number | undefined) ?? null;
      return `${path ? `Description on ${path} ` : "This description "}is ${len ? len + " chars" : "over 160 chars"} — trim to 70–160 chars while keeping the original hook.`;
    }
    case "R030": {
      const len = (ctx.evidence?.meta_description_length as number | undefined) ?? null;
      return `${path ? `Description on ${path} ` : "This description "}is only ${len ? len + " chars" : "under 70 chars"} — expand with a benefit, modifier, or call to action.`;
    }
    case "R031": {
      const dups = (ctx.evidence?.duplicate_urls as string[] | undefined) ?? [];
      return `${path ? `${path} shares its meta description ` : "This description is shared "}with ${dups.length} other page${dups.length === 1 ? "" : "s"}. Rewrite each so they differentiate in the SERP.`;
    }
    case "R033":
      return `${path ? `${path} has no H1. ` : ""}Add a single \`<h1>\` declaring the page's primary topic, including its main keyword.`;
    case "R034":
      return `${path ? `H1 on ${path} ` : "The H1 "}is generic (${ctx.current_value ?? "?"}). Rewrite it to name the page's specific topic.`;
    case "R035":
      return `${path ? `${path} has no Open Graph title. ` : ""}Add \`<meta property="og:title" content="…">\` — typically a punchier version of the page title.`;
    case "R036":
      return `${path ? `${path} has no Open Graph image. ` : ""}Add \`<meta property="og:image">\` pointing to a 1200×630 absolute URL.`;
    case "R037": {
      const status = (ctx.evidence?.status as number | undefined) ?? null;
      const url = (ctx.evidence?.og_image as string | undefined) ?? null;
      return `og:image on ${path ?? "this page"} returns HTTP ${status ?? "non-200"}${url ? ` (${url})` : ""}. Replace with a working image URL.`;
    }
    case "R041": {
      const missing = (ctx.evidence?.missing_count as number | undefined) ?? 0;
      const total = (ctx.evidence?.total_images as number | undefined) ?? 0;
      return `${missing} of ${total || "?"} images on ${path ?? "this page"} are missing alt text. Add descriptive \`alt\` attributes to each.`;
    }
    case "R042": {
      const n = (ctx.evidence?.count as number | undefined) ?? 0;
      return `${n} image${n === 1 ? "" : "s"} on ${path ?? "this page"} have alt text over 125 chars. Trim to a concise description while keeping the meaning.`;
    }
    case "R045": {
      const wc = (ctx.evidence?.word_count as number | undefined) ?? null;
      return `${path ?? "This page"} has ${wc ?? "fewer than 300"} words. Either expand past 300 words with substantive content, or noindex it.`;
    }
    case "R046": {
      const wc = (ctx.evidence?.word_count as number | undefined) ?? null;
      return `${path ?? "This page"} has only ${wc ?? "<100"} words. Almost always indicates an empty template or stub — decide whether to expand, merge, or remove it.`;
    }
    case "R048":
      return `${path ?? "This page"} has zero inbound internal links — it can only be discovered via the sitemap. Link to it from at least one topical hub.`;
    case "R049":
      return `${path ?? "This page"} has only one inbound internal link. Add 1–2 more from contextually related pages.`;
    case "R050": {
      const d = (ctx.evidence?.click_depth as number | undefined) ?? null;
      return `${path ?? "This page"} is ${d ? d + " clicks" : "more than 4 clicks"} from the homepage. Surface it via a nav or hub page so it's reachable in 3 clicks or fewer.`;
    }
    case "R051": {
      const broken = (ctx.evidence?.broken_links as { url: string; status: number }[] | undefined) ?? [];
      const sample = broken.slice(0, 3).map((b) => `${b.url} (${b.status})`).join(", ");
      return `${path ?? "This page"} contains ${broken.length} broken internal link${broken.length === 1 ? "" : "s"}. Update or remove ${sample ? `these: ${sample}` : "each one"}.`;
    }
    case "R052": {
      const broken = (ctx.evidence?.broken_links as { url: string; status: number }[] | undefined) ?? [];
      return `${path ?? "This page"} contains ${broken.length} broken external link${broken.length === 1 ? "" : "s"}. Replace each with a current source or remove it.`;
    }
    case "R053": {
      const n = (ctx.evidence?.generic_anchor_count as number | undefined) ?? 0;
      return `${path ?? "This page"} has ${n} generic anchor${n === 1 ? "" : "s"} ("click here" / "read more"). Rewrite each to describe the destination.`;
    }
    case "R055": {
      const dup = (ctx.evidence?.duplicate_of_url as string | undefined) ?? null;
      return `${path ?? "This page"} has identical content to ${dup ?? "another page"}. Pick one as canonical and either 301 the duplicate or set its \`<link rel="canonical">\` to the canonical URL.`;
    }
    case "R057": {
      const matches = (ctx.evidence?.matches as string[] | undefined) ?? [];
      return `${path ?? "This page"} contains placeholder text (${matches.slice(0, 3).join(", ")}). Replace with final, intentional copy.`;
    }
    case "R058": {
      const matches = (ctx.evidence?.matches as string[] | undefined) ?? [];
      return `${path ?? "This page"} contains unrendered template variables (${matches.slice(0, 3).join(", ")}). Investigate the templating engine and ship real content.`;
    }
    case "R067":
      return `${path ?? "This page"} has FAQ-format headings (questions ending in "?") but no FAQPage schema. Wrap the Q&A in JSON-LD FAQPage to qualify for rich results.`;
    case "R069":
      return `Article schema on ${path ?? "this page"} is missing the \`author\` field. Add an author with \`@type: Person\`, \`name\`, and a URL to a bio.`;
    case "R070":
      return `${path ?? "This article"} has no Article schema. Add an Article (or BlogPosting / NewsArticle) JSON-LD block with \`headline\`, \`author\`, \`datePublished\`, and \`image\`.`;
    case "R073":
      return `${path ?? "This article"} was published over 18 months ago and has no recent \`dateModified\`. Refresh dated info and update \`dateModified\` to today, or noindex it.`;
    case "R074": {
      const wc = (ctx.evidence?.word_count as number | undefined) ?? null;
      return `${path ?? "This article"} is ${wc ?? "over 2000"} words but has no table of contents. Add a jump-link TOC anchored to the section headings.`;
    }
    default:
      return generic ?? "We'll detail the specific fix steps for this rule in a future release.";
  }
}

function pathOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.pathname === "/" || u.pathname === "") return "the homepage";
    return u.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function stripPrefix(s: string): string {
  // current_value is usually formatted like `<n> characters: "<actual>"` — pull out just the quoted value when present.
  const m = s.match(/"([^"]+)"/);
  return m ? m[1] : s;
}
