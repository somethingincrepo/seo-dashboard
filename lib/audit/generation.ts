/**
 * Maps rule_ids to the agent SOP that generates their fix copy, and
 * provides a chunker for batching issues into jobs.
 *
 * Rules in MECHANICAL_RULE_IDS are handled deterministically (see
 * mechanical-fixes.ts) and never reach this module.
 *
 * Rules not in either set get no auto-fix at all — they retain their static
 * fix_guidance and need editorial judgment from the user.
 */

export type FixType = "title" | "meta_description" | "h1" | "alt_text" | "anchor" | "schema";

export const RULE_TO_FIX_TYPE: Record<string, FixType> = {
  // Title (Haiku)
  R023: "title",
  R024: "title",
  R025: "title",
  R026: "title",
  R027: "title",

  // Meta description (Haiku)
  R028: "meta_description",
  R029: "meta_description",
  R030: "meta_description",
  R031: "meta_description",
  R032: "meta_description",

  // H1 (Haiku)
  R033: "h1",
  R034: "h1",

  // Alt text (Haiku)
  R041: "alt_text",
  R042: "alt_text",
  R043: "alt_text",

  // Anchor text (Haiku)
  R053: "anchor",

  // Schema (Sonnet — JSON-LD validity matters more)
  R040: "schema",
  R067: "schema",
  R068: "schema",
  R069: "schema",
  R070: "schema",
  R071: "schema",
  R072: "schema",
  R075: "schema",
};

export const FIX_TYPE_TO_SOP: Record<FixType, string> = {
  title: "generate_fix_title",
  meta_description: "generate_fix_meta_description",
  h1: "generate_fix_h1",
  alt_text: "generate_fix_alt_text",
  anchor: "generate_fix_anchor",
  schema: "generate_fix_schema",
};

/** Group issues by fix-type so we can emit one job per chunk per fix-type. */
export function groupByFixType<T extends { id: string; rule_id: string }>(
  issues: T[],
): Map<FixType, T[]> {
  const out = new Map<FixType, T[]>();
  for (const i of issues) {
    const ft = RULE_TO_FIX_TYPE[i.rule_id];
    if (!ft) continue;
    if (!out.has(ft)) out.set(ft, []);
    out.get(ft)!.push(i);
  }
  return out;
}

/** Splits a list into chunks of size `n`. */
export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Issues per fan-out job. Tuned to keep a single SOP run under the 10-minute timeout. */
export const ISSUES_PER_JOB = 10;
