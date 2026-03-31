import { airtableFetch, airtablePatch } from "./airtable";
import type { AirtableRecord } from "./clients";

export type ChangeFields = {
  change_id: string;
  client_id: string;
  change_type: string;  // old field name
  type: string;         // new field name
  category: string;     // old field name
  cat: string;          // new field name
  page_url: string;
  current_value: string;
  proposed_value: string;
  approval_status: string;  // old field name
  approval: string;         // new field name
  execution_status: string;
  implementation_tier: string;
  confidence: string;
  priority: string;
  reasoning: string;
  is_nav_page: boolean;
  doc_url: string;
  client_notes: string;
  identified_at: string;
  approved_at: string;
  implemented_at: string;
  job_id: string;
};

export type Change = AirtableRecord<ChangeFields>;

const TABLE = "Changes";

export async function getPendingApprovals(clientId?: string): Promise<Change[]> {
  const filter = clientId
    ? `AND(OR({approval}="pending",{approval_status}="pending"),FIND("${clientId}",ARRAYJOIN({client_id})))`
    : `OR({approval}="pending",{approval_status}="pending")`;
  return airtableFetch<Change>(TABLE, {
    filterByFormula: filter,
    sort: [{ field: "confidence", direction: "desc" }],
  });
}

export async function getClientChanges(clientId: string): Promise<Change[]> {
  return airtableFetch<Change>(TABLE, {
    filterByFormula: `FIND("${clientId}",ARRAYJOIN({client_id}))`,
  });
}

export async function updateApproval(
  recordId: string,
  decision: "approved" | "skipped" | "question",
  notes?: string
): Promise<void> {
  const fields: Record<string, unknown> = {
    approval: decision,
    approval_status: decision,  // update both fields for compatibility
  };
  if (notes) fields.client_notes = notes;
  if (decision === "approved") fields.approved_at = new Date().toISOString();
  await airtablePatch(TABLE, recordId, fields);
}
