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
 *   [REMOVED]content[/REMOVED]          — removed content (strikethrough, shown for audit trail)
 *
 * The multi-line [LI]...[/LI] form is collapsed into a single line first,
 * then the line-by-line pass converts everything to HTML.
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
  // Wrap inner content, preserve internal newlines for further processing
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

    // Inline replacements
    const inlined = line
      .replace(/\[B\]/g, "<strong>")
      .replace(/\[\/B\]/g, "</strong>")
      .replace(/\[STRONG\]/g, "<strong>")
      .replace(/\[\/STRONG\]/g, "</strong>")
      .replace(/\[LI\]\s*(.*?)\[\/LI\]/g, "<li>$1</li>")
      .replace(/\[LI\]\s*(.*)/g, "<li>$1</li>");

    // Block-level tag conversions
    const mapped = inlined
      .replace(/^\[H1\]\s*(.+?)\s*(\[\/H1\])?$/, "<h1>$1</h1>")
      .replace(/^\[H2\]\s*(.+?)\s*(\[\/H2\])?$/, "<h2>$1</h2>")
      .replace(/^\[H3\]\s*(.+?)\s*(\[\/H3\])?$/, "<h3>$1</h3>")
      .replace(/^\[P\]\s*(.+?)\s*(\[\/P\])?$/, "<p>$1</p>")
      .replace(/^\[UL\]$/, "<ul>")
      .replace(/^\[\/UL\]$/, "</ul>")
      .replace(/^\[OL\]$/, "<ol>")
      .replace(/^\[\/OL\]$/, "</ol>")
      .replace(/^\[\/LI\]$/, "")
      .replace(/^\[\/H[123]\]$/, "")
      .replace(/^\[\/P\]$/, "");

    if (mapped.trim()) out.push(mapped);
  }

  return out.join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
