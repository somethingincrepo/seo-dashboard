import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.airtable.com/v0";

function getContentHeaders() {
  const apiKey = process.env.CONTENT_AIRTABLE_API_KEY;
  if (!apiKey) throw new Error("CONTENT_AIRTABLE_API_KEY not set");
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

const CONTENT_BASE_ID = process.env.CONTENT_AIRTABLE_BASE_ID;
const JOBS_TABLE = "Content Jobs";
const RESULTS_TABLE = "Results";

/** Approve or skip a content title */
async function handleJobTitle(recordId: string, action: string) {
  const fields: Record<string, unknown> = { title_status: action };
  if (action === "approved") {
    fields.approved_at = new Date().toISOString();
    // Setting Status to "Queued" triggers the n8n content generation workflow
    fields.Status = "Queued";
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
    const webhookUrl = process.env.N8N_CONTENT_WEBHOOK_URL || "https://somethingincorporated.app.n8n.cloud/webhook/42b82c45-bb9e-4597-a0df-2b9ab9b2863f";
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: recordId, trigger: "portal_approval" }),
      });
    } catch {
      // Non-fatal — Status=Queued is already set in Airtable as fallback
    }
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
}

export async function POST(request: NextRequest) {
  try {
    const { recordId, action, type } = await request.json();
    if (!recordId || !action) {
      return NextResponse.json({ error: "Missing recordId or action" }, { status: 400 });
    }
    if (!["approved", "skipped", "needs_revision"].includes(action)) {
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
