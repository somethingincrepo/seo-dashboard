import { airtableFetch, airtablePatch } from "./airtable";
import type { AirtableRecord } from "./clients";

export type ChangeFields = {
  change_id: number;
  client_id: string[];
  type: string;
  cat: string;
  page_url: string;
  current_value: string;
  proposed_value: string;
  approval: string;
  execution_status: string;
  implementation_tier: string;
  confidence: string;
  priority: number;
  reasoning: string;
  is_nav_page: boolean;
  doc_url: string;
  client_notes: string;
  identified_at: string;
  approved_at: string;
  implemented_at: string;
  job_id: string[];
};

export type Change = AirtableRecord<ChangeFields>;

const TABLE = process.env.AIRTABLE_CHANGES_TABLE || "Changes";

export async function getPendingApprovals(clientRecordId?: string): Promise<Change[]> {
  const filter = clientRecordId
    ? `AND({approval}="pending",FIND("${clientRecordId}",ARRAYJOIN({client_id})))`
    : `{approval}="pending"`;
  return airtableFetch<Change>(TABLE, {
    filterByFormula: filter,
    sort: JSON.stringify([{ field: "priority", direction: "desc" }]),
  });
}

export async function getClientChanges(clientRecordId: string): Promise<Change[]> {
  return airtableFetch<Change>(TABLE, {
    filterByFormula: `FIND("${clientRecordId}",ARRAYJOIN({client_id}))`,
    sort: JSON.stringify([{ field: "priority", direction: "desc" }]),
  });
}

export async function updateApproval(
  recordId: string,
  decision: "approved" | "skipped" | "question",
  notes?: string
): Promise<void> {
  const fields: Record<string, unknown> = { approval: decision };
  if (notes) fields.client_notes = notes;
  if (decision === "approved") fields.approved_at = new Date().toISOString();
  await airtablePatch(TABLE, recordId, fields);
}
