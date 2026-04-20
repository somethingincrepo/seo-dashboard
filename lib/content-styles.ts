import { contentAirtableFetch, contentAirtablePatch } from "./airtable";

// ── Style definitions ─────────────────────────────────────────────────────────

export const CONTENT_STYLES = [
  {
    id: "thought_leadership",
    label: "Thought Leadership",
    description: "Authoritative expert POV — original insight, not generic tips",
    promptModifier:
      "Write titles that signal original expertise, industry authority, and fresh perspective. Avoid generic how-to framing — lean toward provocative claims, counterintuitive angles, or clear expert stances.",
  },
  {
    id: "how_to",
    label: "How-To",
    description: "Step-by-step, instructional, actionable",
    promptModifier:
      "Write titles in instructional how-to formats. Readers want a clear, actionable process. Formats like 'How to [X]', 'A Step-by-Step Guide to [X]', or '[X] in [N] Steps' work well.",
  },
  {
    id: "listicle",
    label: "Listicle",
    description: "Enumerated points, scannable, concrete examples",
    promptModifier:
      "Write titles that signal a numbered list format — e.g. '7 Ways to...', 'The 5 Best...', 'X Reasons Why...'. Specific numbers are preferred over vague quantity words.",
  },
  {
    id: "case_study",
    label: "Case Study",
    description: "Narrative, evidence-based, results-focused",
    promptModifier:
      "Write titles that tease a real-world story, measurable result, or proof point. Signal 'this actually happened' — e.g. 'How [Company/Type] Did [Result]', 'What We Learned From [X]'.",
  },
  {
    id: "comparison",
    label: "Comparison",
    description: "Side-by-side analysis, decision-oriented",
    promptModifier:
      "Write titles that set up a direct comparison — helping readers evaluate options before making a decision. Formats like '[X] vs [Y]', 'Which [Option] Is Right for [Audience]', or '[A] or [B]? Here's How to Decide' work well.",
  },
  {
    id: "faq",
    label: "FAQ / Q&A",
    description: "Question-led, direct answers, conversational",
    promptModifier:
      "Write titles as natural questions that match what someone would literally type into Google. Use formats like 'What Is [X]?', 'Can You [X]?', 'Is [X] Worth It?', 'Why Does [X] Happen?'.",
  },
] as const;

export type ContentStyleId = (typeof CONTENT_STYLES)[number]["id"];

// ── Airtable field name ───────────────────────────────────────────────────────
// Plain text field, comma-separated style IDs
// Field must exist in the Content Airtable "Clients" table.

const STYLES_FIELD = "Content styles";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseStyles(raw: string | undefined | null): ContentStyleId[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => CONTENT_STYLES.some((def) => def.id === s)) as ContentStyleId[];
}

export function serializeStyles(ids: ContentStyleId[]): string {
  return ids.join(", ");
}

/** Build the prompt modifier block from a list of style IDs. Returns empty string if no styles. */
export function buildStylesPromptBlock(styleIds: ContentStyleId[]): string {
  if (!styleIds.length) return "";

  const modifiers = styleIds
    .map((id) => CONTENT_STYLES.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => `- ${s!.label}: ${s!.promptModifier}`)
    .join("\n");

  return `CONTENT STYLES (apply ALL of the following simultaneously):
${modifiers}`;
}

// ── Data access ───────────────────────────────────────────────────────────────

/** Fetch styles for a client by their company name (Content Airtable key). */
export async function getContentStyles(
  companyName: string
): Promise<{ recordId: string; styleIds: ContentStyleId[] } | null> {
  try {
    const records = await contentAirtableFetch<{
      id: string;
      fields: Record<string, string>;
    }>("Clients", { filterByFormula: `{Client Name}="${companyName.replace(/"/g, '\\"')}"` });

    if (!records.length) return null;

    const record = records[0];
    const raw = record.fields[STYLES_FIELD];
    return { recordId: record.id, styleIds: parseStyles(raw) };
  } catch {
    return null;
  }
}

/** Save styles for a client by Content Airtable record ID. */
export async function saveContentStyles(
  recordId: string,
  styleIds: ContentStyleId[]
): Promise<void> {
  await contentAirtablePatch("Clients", recordId, {
    [STYLES_FIELD]: serializeStyles(styleIds),
  });
}
