/**
 * Write deterministic internal-link proposals to the Airtable Changes table
 * (the source of truth for the portal's "Internal Links" approval queue).
 *
 * This is the deterministic replacement for the `audit_internal_links` SOP's
 * Step 6 ("Write Changes records"). The proposed_value column receives the
 * v1 LinkProposal JSON, which the portal renders as a before/after view of
 * the actual on-page paragraph — no LLM-rewritten prose.
 */

import { airtableCreate, airtableFetch } from "../../airtable";
import type { LinkProposal } from "./types";

interface MinimalChangeRow { id: string; fields: { client_id?: string; type?: string; approval?: string } }

const CHANGES_TABLE = "Changes";

export interface WriteChangesInput {
  /** Airtable Clients record ID (recXXX). */
  clientId: string;
  /** Audit run ID, written into reasoning for traceability. */
  auditRunId: string;
  /** Proposals from generator.ts. */
  proposals: LinkProposal[];
  /** Maximum new Change records to write (the package's monthly quota minus what's already pending/approved). */
  quota: number;
  /** ISO timestamp for `identified_at`. */
  nowIso?: string;
}

export interface WriteChangesResult {
  written: number;
  skipped_existing: number;
  skipped_quota: number;
}

/**
 * Idempotent: any existing pending Internal Link Change for this client with
 * the same (source, target) pair is reused, not duplicated. Approved /
 * implemented Changes for the same pair also block a re-write so we never
 * reapprove a link the client already shipped.
 */
export async function writeInternalLinkChanges(input: WriteChangesInput): Promise<WriteChangesResult> {
  const { clientId, auditRunId, proposals, quota } = input;
  const nowIso = input.nowIso ?? new Date().toISOString();
  if (proposals.length === 0 || quota <= 0) {
    return { written: 0, skipped_existing: 0, skipped_quota: proposals.length };
  }

  // Pull existing Internal Link rows for this client so we can dedupe by (source, target).
  const existing = await airtableFetch<MinimalChangeRow & { fields: { proposed_value?: string; approval?: string; type?: string; page_url?: string } }>(
    CHANGES_TABLE,
    {
      filterByFormula: `AND(OR(FIND("${clientId}",{client_id}),{client_id}="${clientId}"),{type}="Internal Link")`,
    },
  );
  const existingPairs = new Set<string>();
  for (const row of existing) {
    const proposed = row.fields.proposed_value;
    if (!proposed) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(proposed); } catch { continue; }
    const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      const o = item as { source_url?: string; target_url?: string };
      if (o?.source_url && o?.target_url) {
        existingPairs.add(pairKey(o.source_url, o.target_url));
      }
    }
  }

  // Sort proposals by score so the most valuable ones land first when quota
  // is binding. Generator already returns them grouped per-issue with stable
  // ordering — this just gives a global order across issues.
  const ranked = [...proposals].sort((a, b) => {
    if (a.score_components.phrase_priority !== b.score_components.phrase_priority)
      return a.score_components.phrase_priority - b.score_components.phrase_priority;
    if (a.score_components.page_type_fit !== b.score_components.page_type_fit)
      return a.score_components.page_type_fit - b.score_components.page_type_fit;
    if (a.score_components.authority !== b.score_components.authority)
      return b.score_components.authority - a.score_components.authority;
    return a.source_url.localeCompare(b.source_url);
  });

  let written = 0;
  let skippedExisting = 0;
  let skippedQuota = 0;

  for (const p of ranked) {
    if (existingPairs.has(pairKey(p.source_url, p.target_url))) {
      skippedExisting += 1;
      continue;
    }
    if (written >= quota) {
      skippedQuota += 1;
      continue;
    }
    const fields = proposalToChangeFields(p, clientId, auditRunId, nowIso);
    try {
      await airtableCreate(CHANGES_TABLE, fields);
      existingPairs.add(pairKey(p.source_url, p.target_url));
      written += 1;
    } catch (e) {
      console.error("[internal-links] airtableCreate failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return { written, skipped_existing: skippedExisting, skipped_quota: skippedQuota };
}

function pairKey(source: string, target: string): string {
  return `${normalizeUrl(source)}::${normalizeUrl(target)}`;
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    let path = url.pathname.toLowerCase();
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${url.host.toLowerCase()}${path}`;
  } catch {
    return u.toLowerCase();
  }
}

function proposalToChangeFields(
  p: LinkProposal,
  clientId: string,
  auditRunId: string,
  nowIso: string,
): Record<string, unknown> {
  const sourcePath = pathOf(p.source_url);
  const targetPath = pathOf(p.target_url);
  const display = p.anchor_text_display || p.anchor_text;

  const ruleLabel: Record<string, string> = {
    R047: "page links to nothing on your site",
    R048: "orphan page (no inbound links)",
    R049: "single inbound link only",
    R050: "page is buried deep in the site",
  };
  const reason = ruleLabel[p.rule_id] ?? "internal link opportunity";

  const plainEnglish = buildPlainEnglish(p, sourcePath, targetPath, display);
  const businessImpact = buildBusinessImpact(p);
  const priority: "Critical" | "High" | "Medium" | "Low" =
    p.confidence === "High" ? "High" : p.confidence === "Medium" ? "Medium" : "Low";

  return {
    client_id: clientId,
    type: "Internal Link",
    cat: "On-Page",
    approval: "pending",
    confidence: p.confidence,
    priority,
    page_url: p.source_url,
    proposed_value: JSON.stringify(p),
    current_value: `Page ${sourcePath} has ${reason}.`,
    change_title: `Add "${display}" link from ${sourcePath} to ${targetPath}`,
    plain_english_explanation: plainEnglish,
    business_impact_explanation: businessImpact,
    reasoning: `audit_run_id=${auditRunId}; rule=${p.rule_id}; phrase_source=${p.phrase_source}; deterministic-generator-v1`,
    auto_executable: true,
    identified_at: nowIso,
  };
}

function pathOf(u: string): string {
  try {
    const url = new URL(u);
    const p = url.pathname.replace(/\/$/, "");
    return p || "/";
  } catch {
    return u;
  }
}

function buildPlainEnglish(p: LinkProposal, sourcePath: string, targetPath: string, display: string): string {
  const where = p.source_section_heading
    ? `in the "${p.source_section_heading}" section of ${sourcePath}`
    : `inside an existing paragraph on ${sourcePath}`;
  return `We will turn the words "${display}" ${where} into a link that goes to ${targetPath}. We picked these exact words because they already appear on the page and accurately describe the destination, so the wording you see now stays the same — only the link is added.`;
}

function buildBusinessImpact(p: LinkProposal): string {
  switch (p.rule_id) {
    case "R047":
      return "This page currently sends visitors nowhere on your site. Adding contextual links keeps people moving toward your service and product pages instead of leaving.";
    case "R048":
      return "Search engines find new pages by following links. Right now nothing on your site links here, so this page is invisible to crawlers and rarely appears in results.";
    case "R049":
      return "A page with only one inbound link gets weak ranking signals. Adding a second link from a related page strengthens this page's topical authority and discoverability.";
    case "R050":
      return "Pages buried deep in the site rank worse than pages reachable from the homepage in a few clicks. This new link reduces click depth and helps Google treat the page as important.";
    default:
      return "Adding a contextual internal link reinforces the relationship between these two pages for both search engines and visitors.";
  }
}
