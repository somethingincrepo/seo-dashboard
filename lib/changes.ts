import { airtableFetch, airtablePatch } from "./airtable";
import type { AirtableRecord } from "./clients";

export type ChangeFields = {
  // Primary fields (new names — always prefer these)
  change_id: string;
  client_id: string;
  type: string;              // Metadata, Heading, Schema, Content, FAQ, Redirect, etc.
  cat: string;               // Technical, On-Page, Content, AI-GEO
  page_url: string;
  current_value: string;     // Verbatim current state on the live page
  proposed_value: string;    // Recommended fix (can be technical or readable)
  approval: string;          // pending, approved, skipped, question, backlog
  execution_status: string;  // queued, implementing, complete, failed
  implementation_tier: string; // tier_1, tier_2
  confidence: string;        // High, Medium, Low
  priority: string;          // Critical, High, Medium, Low
  reasoning: string;         // Agent reasoning (internal — data source, why flagged)
  is_nav_page: boolean;
  doc_url: string;           // Google Doc draft link (content changes)
  client_notes: string;      // Client's question/notes from approval
  identified_at: string;
  approved_at: string;
  implemented_at: string;
  reverted_at: string;
  revert_note: string;
  revert_payload: string;
  verified_value: string;    // Post-write read-back from CMS — confirmed "after" state for before/after display
  verification: string;      // "pass" | "unverified" — set by implement SOP after write verification
  job_id: string;
  change_title: string;  // Agent-written short title — e.g. "Fix meta description on Pricing page"
  month: number;

  // Indexing API fields (written by google-indexing tool after submission)
  indexing_status: "not_submitted" | "submitted" | "failed";
  indexing_submitted_at: string;

  // Client-facing fields (populated by audit agent for portal display)
  plain_english_explanation: string;    // "What We Recommend" — client-friendly summary
  business_impact_explanation: string;  // "Why It Matters" — business value, not agent logic

  // Legacy field aliases (for backward compat — never write to these)
  change_type: string;
  category: string;
  approval_status: string;
};

export type Change = AirtableRecord<ChangeFields>;

const TABLE = "Changes";

// clientId may be an Airtable record ID (recXXX — written by SOPs) or a slug field value.
// Search both so portal and admin views work regardless of which was stored.
function clientFilter(clientId: string): string {
  return `OR(FIND("${clientId}",{client_id}),{client_id}="${clientId}")`;
}

export async function getPendingApprovals(clientId?: string, recordId?: string): Promise<Change[]> {
  let filter: string;
  if (!clientId && !recordId) {
    filter = `{approval}="pending"`;
  } else if (clientId && recordId && clientId !== recordId) {
    filter = `AND({approval}="pending",OR(FIND("${clientId}",{client_id}),FIND("${recordId}",{client_id})))`;
  } else {
    const id = clientId || recordId!;
    filter = `AND({approval}="pending",${clientFilter(id)})`;
  }
  return airtableFetch<Change>(TABLE, {
    filterByFormula: filter,
    sort: [{ field: "confidence", direction: "desc" }],
  });
}

export async function getClientChanges(clientId: string, recordId?: string): Promise<Change[]> {
  const filter = recordId && recordId !== clientId
    ? `OR(FIND("${clientId}",{client_id}),FIND("${recordId}",{client_id}))`
    : clientFilter(clientId);
  return airtableFetch<Change>(TABLE, { filterByFormula: filter });
}

export async function updateApproval(
  recordId: string,
  decision: "approved" | "skipped" | "question",
  notes?: string
): Promise<void> {
  const fields: Record<string, unknown> = {
    approval: decision,
  };
  if (notes) fields.client_notes = notes;
  if (decision === "approved") fields.approved_at = new Date().toISOString();
  await airtablePatch(TABLE, recordId, fields);
}

export async function getChangeById(recordId: string): Promise<Change | null> {
  const records = await airtableFetch<Change>(TABLE, {
    filterByFormula: `RECORD_ID()="${recordId}"`,
    maxRecords: 1,
  });
  return records[0] ?? null;
}

/**
 * Undo any non-pending decision back to pending.
 * Rejects if already implemented.
 */
export async function revertDecision(recordId: string): Promise<{ ok: boolean; error?: string }> {
  const change = await getChangeById(recordId);
  if (!change) return { ok: false, error: "Change not found" };

  // Reject if already implemented
  const implStatus = change.fields.execution_status;
  const implAt = change.fields.implemented_at;
  if (implStatus === "complete" || implAt) {
    return {
      ok: false,
      error: "This change has already been implemented. If you'd like it reverted, let your account manager know and we'll restore the original.",
    };
  }

  await airtablePatch(TABLE, recordId, {
    approval: "pending",
    approved_at: null,
    client_notes: change.fields.client_notes,
  });

  return { ok: true };
}

/**
 * Reset a reverted or revert_failed change back to pending so it can be re-implemented.
 * Clears revert_payload so the implement SOP captures a fresh snapshot.
 */
export async function resetChange(recordId: string): Promise<{ ok: boolean; error?: string }> {
  const change = await getChangeById(recordId);
  if (!change) return { ok: false, error: "Change not found" };

  const status = change.fields.execution_status;
  if (status !== "reverted" && status !== "revert_failed") {
    return { ok: false, error: `Cannot reset — execution_status is "${status}". Only reverted or revert_failed changes can be reset.` };
  }

  await airtablePatch(TABLE, recordId, {
    execution_status: "pending",
    revert_payload: null,
    reverted_at: null,
    revert_note: null,
  });

  return { ok: true };
}
