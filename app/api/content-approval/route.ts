import { NextRequest, NextResponse } from "next/server";
import { getNextPublishDate } from "@/lib/content-schedule";

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

  // When approved for publishing, assign a scheduled publish date.
  // The worker's daily publisherTick queues the actual publish job when that date arrives.
  if (action === "approved") {
    try {
      const scheduledDate = await getNextPublishDate();
      await fetch(`${BASE_URL}/${CONTENT_BASE_ID}/${encodeURIComponent(RESULTS_TABLE)}/${recordId}`, {
        method: "PATCH",
        headers: getContentHeaders(),
        body: JSON.stringify({ fields: { scheduled_publish_date: scheduledDate } }),
      });
    } catch (err) {
      console.error("Failed to assign publish date (non-fatal):", err);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    let parsed: { recordId?: string; action?: string; type?: string };
    try {
      parsed = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { recordId, action, type } = parsed;
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
    const msg = e instanceof Error ? e.message : "Internal error";
    const isNotFound = msg.includes("404") || msg.toLowerCase().includes("not_found") || msg.toLowerCase().includes("not found");
    return NextResponse.json(
      { error: msg },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
