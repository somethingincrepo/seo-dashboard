import { NextRequest, NextResponse } from "next/server";
import { airtableFetch, airtableDelete } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";

// Airtable only lets you delete 1 record at a time via the REST API.
// We fetch all record IDs and delete sequentially in small batches.
async function deleteAllRecords(table: string, filterByFormula: string) {
  const records = await airtableFetch<{ id: string }>(table, {
    filterByFormula,
    fields: [], // fetch no fields — just IDs
    maxRecords: 1000,
  });
  for (const record of records) {
    await airtableDelete(table, record.id);
  }
  return records.length;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Load client to get the client_id slug used in related records
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const clientId = (client.fields.client_id as string) || id;

  const summary: Record<string, number> = {};

  // Delete related Airtable records
  summary.changes = await deleteAllRecords("Changes", `{client_id}="${clientId}"`);
  summary.jobs = await deleteAllRecords("Jobs", `{client_id}="${clientId}"`);

  // Delete the Client record itself
  await airtableDelete("Clients", id);
  summary.client = 1;

  // Delete Supabase rows
  const supabase = getSupabase();
  const { count: jobsDeleted } = await supabase
    .from("jobs")
    .delete({ count: "exact" })
    .eq("client_id", clientId);
  summary.supabase_jobs = jobsDeleted ?? 0;

  const { count: reportsDeleted } = await supabase
    .from("reports")
    .delete({ count: "exact" })
    .eq("client_id", clientId);
  summary.supabase_reports = reportsDeleted ?? 0;

  return NextResponse.json({ deleted: true, summary });
}
