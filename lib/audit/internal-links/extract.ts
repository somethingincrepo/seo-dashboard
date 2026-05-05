/**
 * Deterministic HTML body extractor.
 *
 * Parses raw page HTML into an ordered list of content blocks (paragraphs,
 * list items, sub-headings) suitable for internal-link insertion. Drops
 * navigation, headers, footers, asides, scripts, styles. Tracks where each
 * block already has an existing <a> wrapper so the scanner can avoid those
 * ranges.
 *
 * No external HTML parser dependency: this is a single-pass tokenizer with a
 * stack-based content filter. Same input → same output, byte-for-byte.
 */

export type BlockTag = "p" | "h2" | "h3" | "h4" | "li";

export interface Block {
  /** Element tag this block came from. */
  tag: BlockTag;
  /** Plain text with HTML entities decoded; whitespace collapsed. */
  text: string;
  /** Original HTML between opening and closing tags (inner HTML). */
  inner_html: string;
  /** Heading text for the section this block lives in (nearest preceding h2/h3). */
  section_heading: string | null;
  /**
   * For each char index in `text`, the corresponding start offset in
   * `inner_html`. Length is `text.length + 1` (last entry = end of text).
   * Used to map a plain-text match range back to an HTML range so we can
   * highlight it in the source markup without a second parse.
   */
  text_to_html: number[];
  /**
   * Plain-text ranges already wrapped in an existing <a> tag. The scanner
   * skips matches that overlap any of these so we don't propose a link on
   * top of a link.
   */
  anchored_ranges: Array<[number, number]>;
  /** Approximate position in document flow (0-based across all kept blocks). */
  block_index: number;
}

const SKIP_TAG_TREE = new Set([
  "nav", "header", "footer", "aside",
  "script", "style", "noscript", "svg", "iframe", "template",
  "form", "button", "select",
]);

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const BLOCK_TAGS: ReadonlySet<BlockTag> = new Set<BlockTag>(["p", "h2", "h3", "h4", "li"]);

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  copy: "©", reg: "®", trade: "™",
};

function decodeEntity(raw: string): string {
  if (raw.startsWith("#")) {
    const isHex = raw[1] === "x" || raw[1] === "X";
    const code = isHex ? parseInt(raw.slice(2), 16) : parseInt(raw.slice(1), 10);
    if (Number.isFinite(code) && code > 0) {
      try { return String.fromCodePoint(code); } catch { /* fallthrough */ }
    }
    return "";
  }
  return ENTITIES[raw] ?? "";
}

/** Decode all HTML entities in a string. */
function decodeEntities(s: string): string {
  return s.replace(/&(#?[a-zA-Z0-9]+);/g, (_m, body: string) => {
    const decoded = decodeEntity(body);
    return decoded || _m;
  });
}

interface Tag {
  kind: "open" | "close" | "self";
  name: string;
}

/**
 * Find the next tag in `html` starting at `from`. Returns null if no more
 * tags. Skips comments, doctype, CDATA blocks (returns the position after
 * them as a "no-op" tag, signalled by name="").
 */
function nextTag(html: string, from: number): { tag: Tag; tag_start: number; tag_end: number } | null {
  let i = from;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) return null;
    // Comment
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    // Doctype / CDATA / processing instructions
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      const end = html.indexOf(">", lt + 2);
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    // Real tag
    const closeBracket = findTagEnd(html, lt);
    if (closeBracket === -1) return null;
    const inner = html.slice(lt + 1, closeBracket);
    if (inner.length === 0) { i = closeBracket + 1; continue; }
    let kind: Tag["kind"] = "open";
    let body = inner;
    if (body[0] === "/") { kind = "close"; body = body.slice(1); }
    if (body.endsWith("/")) { kind = kind === "close" ? "close" : "self"; body = body.slice(0, -1); }
    const nameMatch = body.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
    const name = nameMatch ? nameMatch[1].toLowerCase() : "";
    if (kind === "open" && VOID_TAGS.has(name)) kind = "self";
    return { tag: { kind, name }, tag_start: lt, tag_end: closeBracket + 1 };
  }
  return null;
}

/** Find the `>` that closes the tag opening at `lt`, respecting quoted attr values. */
function findTagEnd(html: string, lt: number): number {
  let i = lt + 1;
  let quote: '"' | "'" | null = null;
  while (i < html.length) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else {
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ">") return i;
    }
    i += 1;
  }
  return -1;
}

interface BlockBuilder {
  tag: BlockTag;
  parts: string[];      // raw inner HTML pieces
  text_parts: string[]; // plain text pieces (entity-decoded, tags stripped)
  text_to_html: number[]; // running map: text char i → offset in inner_html
  anchor_stack: number;
  anchor_open_text_idx: number | null;
  anchored_ranges: Array<[number, number]>;
  inner_html_len: number; // running length of joined parts
  text_len: number;       // running length of joined text_parts
}

function startBlock(tag: BlockTag): BlockBuilder {
  return {
    tag,
    parts: [],
    text_parts: [],
    text_to_html: [0],
    anchor_stack: 0,
    anchor_open_text_idx: null,
    anchored_ranges: [],
    inner_html_len: 0,
    text_len: 0,
  };
}

/** Append raw HTML to the block's inner_html stream (without changing text). */
function appendHtmlRaw(b: BlockBuilder, html: string): void {
  b.parts.push(html);
  b.inner_html_len += html.length;
}

/** Append text (already entity-decoded) to both streams, updating the offset map. */
function appendText(b: BlockBuilder, text: string, htmlChunk: string): void {
  if (text.length === 0 && htmlChunk.length === 0) return;
  const htmlStart = b.inner_html_len;
  b.parts.push(htmlChunk);
  b.inner_html_len += htmlChunk.length;
  b.text_parts.push(text);
  for (let i = 0; i < text.length; i++) {
    // Approximate: spread the html chunk uniformly across text characters.
    // For pure text (no entities), this is exact (one html char per text char).
    // For entity-bearing chunks, the mapping is approximate but monotonic,
    // which is what we need for highlighting.
    b.text_to_html.push(htmlStart + Math.min(htmlChunk.length, Math.round(((i + 1) / text.length) * htmlChunk.length)));
  }
  b.text_len += text.length;
}

function finalizeBlock(b: BlockBuilder, sectionHeading: string | null, blockIndex: number): Block {
  // Trim trailing whitespace + collapse internal whitespace runs while keeping
  // the offset map aligned. Simple: collapse runs of whitespace in the joined
  // text and rebuild the map.
  const rawText = b.text_parts.join("");
  const collapsed = collapseWhitespace(rawText, b.text_to_html);
  return {
    tag: b.tag,
    text: collapsed.text,
    inner_html: b.parts.join(""),
    section_heading: sectionHeading,
    text_to_html: collapsed.map,
    anchored_ranges: b.anchored_ranges
      .map(([s, e]) => [collapsed.remap(s), collapsed.remap(e)] as [number, number])
      .filter(([s, e]) => e > s),
    block_index: blockIndex,
  };
}

function collapseWhitespace(
  text: string,
  map: number[],
): { text: string; map: number[]; remap: (i: number) => number } {
  const out: string[] = [];
  const newMap: number[] = [map[0] ?? 0];
  const oldToNew = new Array<number>(text.length + 1);
  let lastWasSpace = true; // trim leading whitespace
  let newIdx = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isSpace = /\s/.test(ch);
    oldToNew[i] = newIdx;
    if (isSpace) {
      if (lastWasSpace) continue;
      out.push(" ");
      newMap.push(map[i + 1] ?? newMap[newMap.length - 1]);
      newIdx += 1;
      lastWasSpace = true;
    } else {
      out.push(ch);
      newMap.push(map[i + 1] ?? newMap[newMap.length - 1]);
      newIdx += 1;
      lastWasSpace = false;
    }
  }
  oldToNew[text.length] = newIdx;
  // Trim trailing space
  if (out.length > 0 && out[out.length - 1] === " ") {
    out.pop();
    newMap.pop();
    newIdx -= 1;
  }
  return {
    text: out.join(""),
    map: newMap,
    remap: (i: number) => Math.max(0, Math.min(newIdx, oldToNew[Math.max(0, Math.min(text.length, i))] ?? 0)),
  };
}

export interface ExtractedBody {
  blocks: Block[];
  /** The page's heading hierarchy, useful for ranking ("which section is this"). */
  outline: Array<{ level: 2 | 3 | 4; text: string }>;
}

export function extractBody(html: string): ExtractedBody {
  const blocks: Block[] = [];
  const outline: ExtractedBody["outline"] = [];

  // Restrict to <body>...</body> if we can find it; otherwise scan the whole
  // document. Some CMS templates omit <body> entirely.
  let scanFrom = 0;
  let scanTo = html.length;
  const bodyOpen = /<body\b[^>]*>/i.exec(html);
  if (bodyOpen) {
    scanFrom = bodyOpen.index + bodyOpen[0].length;
    const bodyClose = html.toLowerCase().lastIndexOf("</body>");
    if (bodyClose > scanFrom) scanTo = bodyClose;
  }

  // Stack of open elements (we only really care about skip-tag depth + the
  // currently-active block, but tracking the stack helps us detect mismatched
  // closes).
  const skipStack: string[] = [];
  let currentBlock: BlockBuilder | null = null;
  let currentSection: string | null = null;
  let cursor = scanFrom;

  while (cursor < scanTo) {
    const next = nextTag(html, cursor);
    if (!next || next.tag_start >= scanTo) {
      // tail text
      if (currentBlock) {
        const tail = html.slice(cursor, scanTo);
        appendText(currentBlock, decodeEntities(tail), tail);
      }
      break;
    }

    // Text before the tag belongs either to the current block or is dropped.
    if (next.tag_start > cursor) {
      const seg = html.slice(cursor, next.tag_start);
      if (currentBlock && skipStack.length === 0) {
        appendText(currentBlock, decodeEntities(seg), seg);
      }
    }

    const { tag, tag_start, tag_end } = next;
    const tagHtml = html.slice(tag_start, tag_end);

    if (tag.name === "") {
      cursor = tag_end;
      continue;
    }

    if (tag.kind === "open" || tag.kind === "self") {
      if (SKIP_TAG_TREE.has(tag.name)) {
        if (tag.kind === "open") skipStack.push(tag.name);
        cursor = tag_end;
        continue;
      }

      if (skipStack.length > 0) {
        cursor = tag_end;
        continue;
      }

      // Track headings for outline + section labelling
      if (tag.name === "h2" || tag.name === "h3" || tag.name === "h4") {
        // Read the heading text by scanning ahead until matching close tag.
        const heading = readUntilClose(html, tag_end, scanTo, tag.name);
        if (heading !== null) {
          const level = tag.name === "h2" ? 2 : tag.name === "h3" ? 3 : 4;
          const cleanText = decodeEntities(heading.text.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
          if (cleanText) {
            outline.push({ level, text: cleanText });
            if (level === 2 || level === 3) currentSection = cleanText;
          }
          // h2/h3/h4 are also block candidates for in-content link insertion.
          cursor = heading.end_after_close;
          continue;
        }
      }

      // Begin a new block?
      if (BLOCK_TAGS.has(tag.name as BlockTag) && tag.kind === "open") {
        if (currentBlock) {
          // Nested block inside a block (rare). Close the current one first.
          const finalized = finalizeBlock(currentBlock, currentSection, blocks.length);
          if (finalized.text.length >= 30) blocks.push(finalized);
          currentBlock = null;
        }
        currentBlock = startBlock(tag.name as BlockTag);
        cursor = tag_end;
        continue;
      }

      // Anchor opening inside an active block — start tracking
      if (currentBlock && tag.name === "a" && tag.kind === "open") {
        if (currentBlock.anchor_stack === 0) {
          currentBlock.anchor_open_text_idx = currentBlock.text_len;
        }
        currentBlock.anchor_stack += 1;
        appendHtmlRaw(currentBlock, tagHtml);
        cursor = tag_end;
        continue;
      }

      // Any other tag inside a block: emit raw HTML, no text contribution
      if (currentBlock) {
        appendHtmlRaw(currentBlock, tagHtml);
      }
      cursor = tag_end;
      continue;
    }

    // tag.kind === "close"
    if (skipStack.length > 0 && skipStack[skipStack.length - 1] === tag.name) {
      skipStack.pop();
      cursor = tag_end;
      continue;
    }
    if (skipStack.length > 0) {
      // Close inside a skip region — ignore
      cursor = tag_end;
      continue;
    }

    if (currentBlock) {
      if (tag.name === "a" && currentBlock.anchor_stack > 0) {
        currentBlock.anchor_stack -= 1;
        appendHtmlRaw(currentBlock, tagHtml);
        if (currentBlock.anchor_stack === 0 && currentBlock.anchor_open_text_idx !== null) {
          currentBlock.anchored_ranges.push([currentBlock.anchor_open_text_idx, currentBlock.text_len]);
          currentBlock.anchor_open_text_idx = null;
        }
        cursor = tag_end;
        continue;
      }
      if (tag.name === currentBlock.tag) {
        const finalized = finalizeBlock(currentBlock, currentSection, blocks.length);
        if (finalized.text.length >= 30) blocks.push(finalized);
        currentBlock = null;
        cursor = tag_end;
        continue;
      }
      // Other close tag inside the block (e.g., </span>, </strong>)
      appendHtmlRaw(currentBlock, tagHtml);
    }
    cursor = tag_end;
  }

  // Flush any unclosed block at end-of-document
  if (currentBlock) {
    const finalized = finalizeBlock(currentBlock, currentSection, blocks.length);
    if (finalized.text.length >= 30) blocks.push(finalized);
  }

  return { blocks, outline };
}

/** Read raw HTML between `from` and the matching `</tagName>`, returning text + new cursor. */
function readUntilClose(
  html: string,
  from: number,
  scanTo: number,
  tagName: string,
): { text: string; end_after_close: number } | null {
  let depth = 1;
  let cursor = from;
  const parts: string[] = [];
  while (cursor < scanTo && depth > 0) {
    const next = nextTag(html, cursor);
    if (!next || next.tag_start >= scanTo) break;
    if (next.tag_start > cursor) parts.push(html.slice(cursor, next.tag_start));
    if (next.tag.name === tagName) {
      if (next.tag.kind === "open") depth += 1;
      else if (next.tag.kind === "close") {
        depth -= 1;
        if (depth === 0) return { text: parts.join(""), end_after_close: next.tag_end };
      }
    }
    cursor = next.tag_end;
  }
  return null;
}
