import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const BASE_URL = "https://api.airtable.com/v0";

function getContentHeaders() {
  const apiKey = process.env.CONTENT_AIRTABLE_API_KEY;
  if (!apiKey) throw new Error("CONTENT_AIRTABLE_API_KEY not set");
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

const CONTENT_BASE_ID = process.env.CONTENT_AIRTABLE_BASE_ID;
const JOBS_TABLE = "Content Jobs";
const RESULTS_TABLE = "Results";

/** Approve, skip, or revert a content title */
async function handleJobTitle(recordId: string, action: string) {
  let fields: Record<string, unknown>;

  if (action === "revert") {
    // Move back to "titled" — only safe while Status is still "Queued" (not yet In Progress)
    fields = {
      title_status: "titled",
      Status: null,       // clear the "Queued" select value
      approved_at: null,
    };
  } else {
    fields = { title_status: action };
    if (action === "approved") {
      fields.approved_at = new Date().toISOString();
      // Setting Status to "Queued" triggers the n8n content generation workflow
      fields.Status = "Queued";
    }
  }

  const res = await fetch(`${BASE_URL}/${CONTENT_BASE_ID}/${encodeURIComponent(JOBS_TABLE)}/${recordId}`, {
    method: "PATCH",
    headers: getContentHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update job: ${err}`);
  }

  if (action === "approved") {
    // Fetch the full job record so we can send the fields n8n's "Get Client" node needs.
    // n8n expects: { recordId, fields: { "Blog Title": "...", "Client ID": [{ id: "rec..." }] } }
    const jobRes = await fetch(`${BASE_URL}/${CONTENT_BASE_ID}/${encodeURIComponent(JOBS_TABLE)}/${recordId}`, {
      headers: getContentHeaders(),
    });
    const jobRecord = jobRes.ok ? await jobRes.json() : { fields: {} };

    // Airtable REST API returns linked records as plain string IDs ["recXXX"].
    // n8n's Get Client node reads fields['Client ID'][0].id, so we must convert to [{ id }] objects.
    const rawFields = jobRecord.fields as Record<string, unknown>;
    const clientIds = ((rawFields["Client ID"] as string[] | undefined) ?? []).map((id) => ({ id }));
    const webhookFields = { ...rawFields, "Client ID": clientIds };

    const webhookUrl = process.env.N8N_CONTENT_WEBHOOK_URL || "https://somethingincorporated.app.n8n.cloud/webhook/status-update";
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, fields: webhookFields }),
    }).catch(() => {/* non-fatal */});
  }
}

/** Approve or skip a completed article */
async function handleResultApproval(recordId: string, action: string) {
  const fields: Record<string, unknown> = {
    portal_approval: action,
    portal_approved_at: new Date().toISOString(),
  };
  const res = await fetch(`${BASE_URL}/${CONTENT_BASE_ID}/${encodeURIComponent(RESULTS_TABLE)}/${recordId}`, {
    method: "PATCH",
    headers: getContentHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update result: ${err}`);
  }

  // When approved for publishing, queue the publish SOP on the Fly.io worker
  if (action === "approved") {
    try {
      // Fetch the result to get the linked job ID
      const resultRes = await fetch(
        `${BASE_URL}/${CONTENT_BASE_ID}/${encodeURIComponent(RESULTS_TABLE)}/${recordId}`,
        { headers: getContentHeaders() }
      );
      const resultRecord = resultRes.ok ? await resultRes.json() as { fields: { "Job ID"?: string[] } } : null;
      const jobId = resultRecord?.fields?.["Job ID"]?.[0];

      const supabase = getSupabase();
      await supabase.from("jobs").insert({
        sop_name: "publish_article_wordpress",
        runner: "fly",
        client_id: null,
        status: "pending",
        payload: { result_id: recordId, job_id: jobId ?? null },
      });
    } catch (err) {
      console.error("Failed to queue publish job (non-fatal):", err);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { recordId, action, type } = await request.json();
    if (!recordId || !action) {
      return NextResponse.json({ error: "Missing recordId or action" }, { status: 400 });
    }
    if (!["approved", "skipped", "needs_revision", "revert"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!CONTENT_BASE_ID) {
      return NextResponse.json({ error: "Content Airtable not configured" }, { status: 500 });
    }

    if (type === "job") {
      await handleJobTitle(recordId, action);
    } else {
      await handleResultApproval(recordId, action);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
