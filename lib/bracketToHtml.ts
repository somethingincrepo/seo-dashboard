/**
 * Convert n8n article bracket markup to HTML.
 *
 * n8n outputs a custom format:
 *   [H1]Title[/H1]  [H2]...[/H2]  [H3]...[/H3]
 *   [P]paragraph[/P]
 *   [UL]
 *   [LI]item[/LI]          ← single-line form
 *   [LI]                    ← multi-line form (content on next lines, closed by [/LI])
 *   long item text here
 *   [/LI]
 *   [/UL]
 *   [B]bold[/B]
 *
 * The multi-line [LI]...[/LI] form is collapsed into a single line first,
 * then the line-by-line pass converts everything to HTML.
 */
export function bracketToHtml(text: string): string {
  if (!text) return "";

  // ── Pre-pass: collapse multi-line [LI]...[/LI] into a single line ──────────
  // Handles both [LI]\ncontent\n[/LI] and [LI]content\nmore\n[/LI]
  let processed = text.replace(
    /\[LI\]([\s\S]*?)\[\/LI\]/g,
    (_match, content: string) =>
      `[LI]${content.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim()}[/LI]`,
  );

  // ── Line-by-line pass ───────────────────────────────────────────────────────
  const lines = processed.split("\n");
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { out.push(""); continue; }

    // Inline replacements first
    const inlined = line
      .replace(/\[B\]/g, "<strong>")
      .replace(/\[\/B\]/g, "</strong>")
      // Same-line list items: [LI]content[/LI] or [LI]content (no close)
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
      // Strip orphaned close tags that survive the pre-pass
      .replace(/^\[\/LI\]$/, "")
      .replace(/^\[\/H[123]\]$/, "")
      .replace(/^\[\/P\]$/, "");

    // Skip lines that became empty after stripping close tags
    if (mapped.trim()) out.push(mapped);
  }

  return out.join("\n");
}
