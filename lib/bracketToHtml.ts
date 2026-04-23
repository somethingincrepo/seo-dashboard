/**
 * Convert article bracket markup to HTML.
 *
 * Standard tags:
 *   [H1]Title[/H1]  [H2]...[/H2]  [H3]...[/H3]
 *   [P]paragraph[/P]
 *   [UL] [LI]item[/LI] [/UL]
 *   [OL] [LI]item[/LI] [/OL]
 *   [B]bold[/B]  [STRONG]bold[/STRONG]
 *
 * Change-tracking tags (used by content-refresh agent):
 *   [ADDED]new content[/ADDED]          — entirely new section/paragraph (green)
 *   [CHANGED from="old text"]new[/CHANGED] — in-place edit (shows del + ins)
 *   [REMOVED]...[/REMOVED]              — removed content (strikethrough)
 *
 * The multi-line [LI]...[/LI] form is collapsed into a single line first,
 * then the line-by-line pass converts everything to HTML.
 *
 * XSS safety: all user-supplied content captured from bracket tags is passed
 * through escapeHtml before being placed into HTML context. A final allowlist
 * sanitization pass strips any HTML tags not produced by this parser.
 */
export function bracketToHtml(text: string): string {
  if (!text) return "";

  // ── Pre-pass 1: collapse multi-line [LI]...[/LI] ──────────────────────────
  let processed = text.replace(
    /\[LI\]([\s\S]*?)\[\/LI\]/g,
    (_match, content: string) =>
      `[LI]${content.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim()}[/LI]`,
  );

  // ── Pre-pass 2: collapse multi-line [ADDED]...[/ADDED] into block ──────────
  processed = processed.replace(
    /\[ADDED\]([\s\S]*?)\[\/ADDED\]/g,
    (_match, inner: string) => {
      const innerHtml = bracketToHtml(inner.trim());
      return `<div class="ct-added"><span class="ct-label ct-label-added">+ Added</span>${innerHtml}</div>`;
    }
  );

  // ── Pre-pass 3: [CHANGED from="..."]new[/CHANGED] ─────────────────────────
  processed = processed.replace(
    /\[CHANGED from="([^"]*)"\]([\s\S]*?)\[\/CHANGED\]/g,
    (_match, oldText: string, newText: string) =>
      `<span class="ct-changed"><del class="ct-del">${escapeHtml(oldText.trim())}</del><ins class="ct-ins">${escapeHtml(newText.trim())}</ins></span>`
  );

  // ── Pre-pass 4: [REMOVED]...[/REMOVED] ────────────────────────────────────
  processed = processed.replace(
    /\[REMOVED\]([\s\S]*?)\[\/REMOVED\]/g,
    (_match, content: string) =>
      `<div class="ct-removed"><span class="ct-label ct-label-removed">− Removed</span><del>${escapeHtml(content.trim())}</del></div>`
  );

  // ── Line-by-line pass ───────────────────────────────────────────────────────
  const lines = processed.split("\n");
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { out.push(""); continue; }

    // Inline replacements — escape captured content to prevent XSS.
    // Block tags processed below may contain the resulting <strong>/<li> HTML,
    // so inline must run first; the final sanitize() pass handles any residual.
    const inlined = line
      .replace(/\[B\](.*?)\[\/B\]/g,         (_m, c: string) => `<strong>${escapeHtml(c)}</strong>`)
      .replace(/\[STRONG\](.*?)\[\/STRONG\]/g, (_m, c: string) => `<strong>${escapeHtml(c)}</strong>`)
      .replace(/\[LI\]\s*(.*?)\[\/LI\]/g,    (_m, c: string) => `<li>${escapeHtml(c)}</li>`)
      .replace(/\[LI\]\s*(.*)/g,              (_m, c: string) => `<li>${escapeHtml(c)}</li>`);

    // Block-level tag conversions.
    // Content may include inline HTML from the step above; sanitize() at the
    // end of the function removes any tags not on the safe allowlist.
    const mapped = inlined
      .replace(/^\[H1\]\s*(.+?)\s*(\[\/H1\])?$/, (_m, c: string) => `<h1>${c}</h1>`)
      .replace(/^\[H2\]\s*(.+?)\s*(\[\/H2\])?$/, (_m, c: string) => `<h2>${c}</h2>`)
      .replace(/^\[H3\]\s*(.+?)\s*(\[\/H3\])?$/, (_m, c: string) => `<h3>${c}</h3>`)
      .replace(/^\[P\]\s*(.+?)\s*(\[\/P\])?$/,   (_m, c: string) => `<p>${c}</p>`)
      .replace(/^\[UL\]$/, "<ul>")
      .replace(/^\[\/UL\]$/, "</ul>")
      .replace(/^\[OL\]$/, "<ol>")
      .replace(/^\[\/OL\]$/, "</ol>")
      .replace(/^\[\/LI\]$/, "")
      .replace(/^\[\/H[123]\]$/, "")
      .replace(/^\[\/P\]$/, "");

    if (mapped.trim()) out.push(mapped);
  }

  return sanitize(out.join("\n"));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Strip any HTML tag not produced by this parser.
 * Allows: h1-h3, p, ul, ol, li, strong, del, ins, br
 * Allows: div/span only when they carry a ct-* class (change-tracking output)
 * Everything else is escaped so it renders as visible text, not executed HTML.
 *
 * Attributes are stripped from all allowlisted tags — only the bare tag name is
 * preserved. This prevents event-handler injection (e.g. <strong onclick=...>).
 */
const SAFE_TAGS = new Set(["h1","h2","h3","p","ul","ol","li","strong","del","ins","br"]);

function sanitize(html: string): string {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tag: string) => {
    const lower = tag.toLowerCase();
    if (SAFE_TAGS.has(lower)) {
      // Return bare tag — strip all attributes to block event-handler injection.
      return match.startsWith("</") ? `</${lower}>` : `<${lower}>`;
    }
    // Allow change-tracking divs and spans produced by the pre-passes
    if ((lower === "div" || lower === "span") && /class="ct-/.test(match)) return match;
    return escapeHtml(match);
  });
}
