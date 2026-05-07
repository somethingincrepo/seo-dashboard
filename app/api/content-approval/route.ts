import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPortalSession } from "@/lib/portal-auth";
import { getClientByToken } from "@/lib/clients";
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

    // Guard: skip webhook when Client ID is empty. The n8n Get Client node
    // looks up `Client ID[0].id` and 404s on an empty array. Surfacing the
    // skip in logs is better than dispatching a guaranteed-failed payload.
    if (clientIds.length === 0) {
      console.error(`[content-approval] skipping webhook — Client ID empty on Content Job ${recordId}`);
    } else {
      const webhookFields = { ...rawFields, "Client ID": clientIds };
      const webhookUrl = process.env.N8N_CONTENT_WEBHOOK_URL || "https://somethingincorporated.app.n8n.cloud/webhook/status-update";
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, fields: webhookFields }),
      }).catch(() => {/* non-fatal */});
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

// Verify the record (Content Job or Result) actually belongs to the calling
// client. Both tables expose the linked Client's name through a lookup
// field; we accept the record if any of those lookup values matches the
// calling client's company_name. This keeps the check simple and avoids
// having to translate between content-base record IDs and main-base IDs.
async function recordBelongsToClient(
  recordId: string,
  type: "job" | "result",
  companyName: string,
): Promise<boolean> {
  const tableName = type === "job" ? JOBS_TABLE : RESULTS_TABLE;
  const url = `${BASE_URL}/${CONTENT_BASE_ID}/${encodeURIComponent(tableName)}/${recordId}`;
  const res = await fetch(url, { headers: getContentHeaders(), cache: "no-store" });
  if (!res.ok) return false;
  const data = (await res.json()) as { fields: Record<string, unknown> };
  const candidates: string[] = [];
  const direct = data.fields["Client Name (from Client ID)"];
  if (Array.isArray(direct)) candidates.push(...(direct as string[]));
  else if (typeof direct === "string") candidates.push(direct);
  const viaJob = data.fields["Client Name (from Client ID) (from Job ID)"];
  if (Array.isArray(viaJob)) candidates.push(...(viaJob as string[]));
  else if (typeof viaJob === "string") candidates.push(viaJob);
  return candidates.includes(companyName);
}

export async function POST(request: NextRequest) {
  // Auth: admin (Bearer or session) OR portal session (customer approving
  // their own content). Portal callers go through an ownership check below.
  const bearer = request.headers.get("authorization");
  const bearerOk = bearer === `Bearer ${process.env.ADMIN_PASSWORD}`;
  const adminOk = bearerOk || (await isAdminAuthenticated());
  let portalClient: Awaited<ReturnType<typeof getClientByToken>> | null = null;
  if (!adminOk) {
    const portalSession = await getPortalSession();
    if (!portalSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    portalClient = await getClientByToken(portalSession.portal_token);
    if (!portalClient) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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

    // Portal callers: verify ownership against the record. We compare against
    // the company name (which is what the Results lookup field returns and
    // what the Content Jobs flow filters by elsewhere — see content.ts and
    // content-schedule.ts for the same pattern).
    if (!adminOk && portalClient) {
      const companyName = portalClient.fields.company_name;
      if (!companyName) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const owns = await recordBelongsToClient(recordId, type === "job" ? "job" : "result", companyName);
      if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
