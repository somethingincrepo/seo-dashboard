import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import { contentAirtableFetch, contentAirtablePatch, contentAirtableCreate, escapeAirtableString } from "@/lib/airtable";
import { PACKAGES, type PackageTier } from "@/lib/packages";
import { getPerTypeQuota, CONTENT_TYPE_CONFIG, type ContentTypeName } from "@/lib/content";

function startOfMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

const CONTENT_JOBS_TABLE = "Content Jobs";
const CONTENT_CLIENTS_TABLE = "Clients";

export const dynamic = "force-dynamic";

async function getContentClientId(companyName: string): Promise<string | null> {
  const records = await contentAirtableFetch<{ id: string }>(
    CONTENT_CLIENTS_TABLE,
    { filterByFormula: `{Client Name}="${escapeAirtableString(companyName)}"` }
  );
  return records[0]?.id ?? null;
}

// Marks the Content Job as Webhook Failed. Splits the write so that Status
// always lands even if the optional `webhook_error` field is missing from
// Airtable schema (returns 422 UNKNOWN_FIELD_NAME on bases that haven't been
// migrated yet).
async function markWebhookFailed(recordId: string, errorMessage: string): Promise<void> {
  await contentAirtablePatch(CONTENT_JOBS_TABLE, recordId, { Status: "Webhook Failed" }).catch((e) => {
    console.error(`[portal/titles] failed to mark Webhook Failed on ${recordId}:`, e);
  });
  await contentAirtablePatch(CONTENT_JOBS_TABLE, recordId, { webhook_error: errorMessage }).catch(() => {
    // webhook_error field may not exist yet — non-fatal.
  });
}

// ---------------------------------------------------------------------------
// GET — fetch titles + keyword_groups + per-type quota for this portal client
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const client = await getClientByToken(token);
    if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const companyName = client.fields.company_name;

    // Parse keyword groups for dropdowns
    let keywordGroups: { group: string; subkeywords: { keyword: string }[] }[] = [];
    try {
      const ai = client.fields.keyword_groups ? JSON.parse(client.fields.keyword_groups) : [];
      const custom = client.fields.custom_keyword_groups ? JSON.parse(client.fields.custom_keyword_groups) : [];
      keywordGroups = [...ai, ...custom];
    } catch { /* ignore */ }

    if (!companyName) return NextResponse.json({ titles: [], keyword_groups: keywordGroups, quota: null, package: "growth" });

    const escaped = escapeAirtableString(companyName);
    const jobs = await contentAirtableFetch<{
      id: string;
      fields: {
        "Blog Title": string;
        title_status: string;
        Status: string;
        target_keyword: string;
        keyword_group: string;
        "Search intent": string;
        content_angle: string;
        quality_score: number;
        proposed_at: string;
        approved_at: string;
        "Desired length range": string;
        refresh_url: string;
        page_type: string;
        scheduled_for_month: string;
      };
    }>(CONTENT_JOBS_TABLE, {
      filterByFormula: `AND(FIND("${escaped}",ARRAYJOIN({Client Name (from Client ID)},",")),{title_status}!="skipped",NOT(FIND("[QA-TEST]",{Blog Title})))`,
      sort: [{ field: "proposed_at", direction: "desc" }],
      maxRecords: 200,
    });

  const pkg = ((client.fields as Record<string, unknown>).package ?? "growth") as PackageTier;
  const monthStart = startOfMonthISO();

  // Classify content type from Airtable data
  function classifyType(j: typeof jobs[0]["fields"]): ContentTypeName {
    if (j.refresh_url) return "refresh";
    if ((j["Desired length range"] ?? "").includes("3,000")) return "longform";
    return "standard";
  }

  const titles = jobs.map((j) => ({
    id: j.id,
    title: j.fields["Blog Title"] ?? "",
    title_status: j.fields.title_status ?? "titled",
    airtable_status: j.fields.Status ?? "",
    target_keyword: j.fields.target_keyword ?? "",
    keyword_group: j.fields.keyword_group ?? "",
    search_intent: j.fields["Search intent"] ?? "",
    content_angle: j.fields.content_angle ?? "",
    quality_score: j.fields.quality_score ?? null,
    proposed_at: j.fields.proposed_at ?? null,
    approved_at: j.fields.approved_at ?? null,
    content_type_name: classifyType(j.fields) as ContentTypeName,
    refresh_url: j.fields.refresh_url ?? null,
    page_type: j.fields.page_type ?? null,
    scheduled_for_month: j.fields.scheduled_for_month ?? null,
  }));

  // Per-type quota
  const quota = getPerTypeQuota(
    jobs.map((j) => ({
      fields: {
        title_status: j.fields.title_status,
        approved_at: j.fields.approved_at,
        "Desired length range": j.fields["Desired length range"],
        refresh_url: j.fields.refresh_url,
      },
    })),
    pkg,
    monthStart
  );

    return NextResponse.json({ titles, keyword_groups: keywordGroups, quota, package: pkg });
  } catch (err) {
    console.error("[GET /api/portal/titles] error:", err);
    const message = err instanceof Error ? err.message : "Failed to load titles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a custom title proposal
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as {
    title?: string;
    target_keyword?: string;
    keyword_group?: string;
    search_intent?: string;
    content_type_name?: ContentTypeName;
  };

  const { title, target_keyword, keyword_group, search_intent, content_type_name } = body;
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  // Refresh jobs live in Supabase and are scheduler-only — never created via this endpoint.
  if (content_type_name === "refresh") {
    return NextResponse.json(
      { error: "Refresh jobs are scheduled automatically and cannot be created via title proposals" },
      { status: 400 }
    );
  }

  const companyName = client.fields.company_name;
  let contentClientId = await getContentClientId(companyName);

  // Auto-create content client record if missing
  if (!contentClientId) {
    const created = await contentAirtableCreate(CONTENT_CLIENTS_TABLE, { "Client Name": companyName });
    contentClientId = created.id;
  }

  const fields: Record<string, unknown> = {
    "Blog Title": title.trim(),
    "Client ID": [contentClientId],
    title_status: "titled",
    proposed_at: new Date().toISOString(),
  };
  if (target_keyword) fields.target_keyword = target_keyword;
  if (keyword_group) fields.keyword_group = keyword_group;
  if (search_intent) fields["Search intent"] = search_intent;

  const created = await contentAirtableCreate(CONTENT_JOBS_TABLE, fields);

  const typeName: ContentTypeName = content_type_name ?? "standard";

  return NextResponse.json({
    ok: true,
    id: created.id,
    title: {
      id: created.id,
      title: title.trim(),
      title_status: "titled",
      airtable_status: "",
      target_keyword: target_keyword ?? "",
      keyword_group: keyword_group ?? "",
      search_intent: search_intent ?? "",
      content_angle: "",
      quality_score: null,
      proposed_at: new Date().toISOString(),
      approved_at: null,
      content_type_name: typeName,
      refresh_url: null,
      page_type: null,
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH — approve (with optional title/keyword/group edits)
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  try {

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as {
    record_id?: string;
    title?: string;
    target_keyword?: string;
    keyword_group?: string;
    action?: "approve" | "save";
    content_type_name?: ContentTypeName;
  };
  const {
    record_id,
    title,
    target_keyword,
    keyword_group,
    action = "approve",
    content_type_name,
  } = body;

  if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });

  // Refresh jobs live in Supabase — the titles endpoint only handles n8n articles.
  if (content_type_name === "refresh") {
    return NextResponse.json(
      { error: "Refresh jobs are managed in Supabase, not via title proposals" },
      { status: 400 }
    );
  }

  const pkg = ((client.fields as Record<string, unknown>).package ?? "growth") as PackageTier;
  const monthStart = startOfMonthISO();
  const companyName = client.fields.company_name;

  // Ownership check — verify this record belongs to the authenticated client
  const escapedName = escapeAirtableString(companyName);
  const ownerCheck = await contentAirtableFetch<{ id: string }>(CONTENT_JOBS_TABLE, {
    filterByFormula: `AND(RECORD_ID()="${record_id}",FIND("${escapedName}",ARRAYJOIN({Client Name (from Client ID)},",")))`,
    maxRecords: 1,
  });
  if (!ownerCheck[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Per-type quota check on approve
  if (action === "approve") {
    const typeName: ContentTypeName = content_type_name ?? "standard";

    const allJobs = await contentAirtableFetch<{
      id: string;
      fields: {
        title_status?: string;
        approved_at?: string;
        "Desired length range"?: string;
        refresh_url?: string;
      };
    }>(CONTENT_JOBS_TABLE, {
      filterByFormula: `AND(FIND("${escapeAirtableString(companyName)}",ARRAYJOIN({Client Name (from Client ID)},",")),{title_status}="approved")`,
      fields: ["title_status", "approved_at", "Desired length range", "refresh_url"],
    });

    const quota = getPerTypeQuota(allJobs, pkg, monthStart);
    const typeQuota = quota[typeName];

    if (typeQuota.used >= typeQuota.limit) {
      // Quota full — schedule for next month instead of hard-rejecting
      const now = new Date();
      const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const nextMonth = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const nextMonthLabel = nextMonthDate.toLocaleString("en-US", { month: "long", year: "numeric" });

      // Persist the next-month queue state. Worker's monthlyActivatorTick reads
      // these fields and flips the title_status to "approved" when the
      // scheduled month rolls around. Schema added 2026-05-05.
      const nextMonthFields: Record<string, unknown> = {
        title_status: "next_month",
        scheduled_for_month: nextMonth,
      };
      if (title?.trim()) nextMonthFields["Blog Title"] = title.trim();
      if (target_keyword !== undefined) nextMonthFields.target_keyword = target_keyword;
      if (keyword_group !== undefined) nextMonthFields.keyword_group = keyword_group;

      await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, nextMonthFields);

      return NextResponse.json({
        ok: true,
        next_month: true,
        scheduled_for: nextMonth,
        message: `Your ${CONTENT_TYPE_CONFIG[typeName].label} slots for this month are full — this article has been queued for ${nextMonthLabel}.`,
      });
    }
  }

  const fields: Record<string, unknown> = {};

  if (action === "approve") {
    const typeName: ContentTypeName = content_type_name ?? "standard";
    const cfg = CONTENT_TYPE_CONFIG[typeName];

    fields.title_status = "approved";
    fields.approved_at = new Date().toISOString();
    fields.Status = "Queued";
    fields["Content type"] = cfg.airtableContentType;
    fields["Desired length range"] = cfg.airtableLengthRange;
  }

  if (title?.trim()) fields["Blog Title"] = title.trim();
  if (target_keyword !== undefined) fields.target_keyword = target_keyword;
  if (keyword_group !== undefined) fields.keyword_group = keyword_group;

  // Fetch current record for job routing
  let jobRecord: {
    fields: {
      "Blog Title": string;
      "Client ID"?: string[];
      "Search intent"?: string;
    };
  } | null = null;
  if (action === "approve") {
    const jobs = await contentAirtableFetch<{
      id: string;
      fields: {
        "Blog Title": string;
        "Client ID"?: string[];
        "Search intent"?: string;
      };
    }>(CONTENT_JOBS_TABLE, {
      filterByFormula: `RECORD_ID()="${record_id}"`,
      maxRecords: 1,
    });
    jobRecord = jobs[0] ?? null;
  }

  await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, fields);

  // Route to the right job processor on approval (n8n new-article writing only)
  if (action === "approve") {
    const typeName: ContentTypeName = content_type_name ?? "standard";

    {
      const cfg = CONTENT_TYPE_CONFIG[typeName];
      const webhookUrl = process.env.N8N_CONTENT_WEBHOOK_URL;

      if (!webhookUrl) {
        console.error("[portal/titles] N8N_CONTENT_WEBHOOK_URL not set; cannot fire content webhook");
        await markWebhookFailed(record_id, "N8N_CONTENT_WEBHOOK_URL env var not configured");
      } else {
        // Standard / Long-Form → fire-and-forget n8n webhook (do not await — n8n
        // latency must not block the portal user's approval response). 10s
        // abort guards against a hung n8n holding the JS event loop.
        const blogTitle = title?.trim() || jobRecord?.fields["Blog Title"] || "";
        const rawClientIds = jobRecord?.fields["Client ID"] ?? [];
        const clientIds = rawClientIds.map((id) => ({ id }));
        const searchIntent = jobRecord?.fields["Search intent"] || "informational";

        // Guard: never fire the webhook with an empty Client ID array. The n8n
        // workflow's Get Client node looks up `Client ID[0].id`, which 404s on
        // an empty array. Surfacing a hard error here is better than dispatching
        // a payload that's guaranteed to fail downstream.
        if (clientIds.length === 0) {
          console.error(`[portal/titles] refusing to fire n8n webhook — Client ID array empty for record ${record_id}`);
          await markWebhookFailed(record_id, "Client ID linked field empty on Content Job; cannot fire content webhook");
          return NextResponse.json({ ok: true, warning: "approved but content webhook skipped — Client ID missing on Content Job" });
        }
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordId: record_id,
            fields: {
              "Blog Title": blogTitle,
              "Client ID": clientIds,
              "Search intent": searchIntent,
              // Single-select Airtable field — must be a plain string, not { id, name }.
              "Content type": cfg.airtableContentType,
              "Desired length range": cfg.airtableLengthRange,
            },
          }),
          signal: AbortSignal.timeout(30_000),
        }).then(async (webhookRes) => {
          if (!webhookRes.ok) {
            const errBody = await webhookRes.text().catch(() => "");
            await markWebhookFailed(record_id, `n8n responded ${webhookRes.status}: ${errBody.slice(0, 500)}`);
          }
        }).catch((err: unknown) => {
          // Timeout / network error: leave Status="Queued" so contentJobWatchdog
          // retries from the worker (different egress path). Only markWebhookFailed
          // on explicit non-2xx above — those are real n8n rejections.
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[portal/titles] webhook fetch failed (will retry via watchdog) for ${record_id}: ${msg}`);
        });
      }
    }
  }

  return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[PATCH /api/portal/titles] error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — skip/reject a title
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as { record_id?: string };
  const { record_id } = body;

  if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });

  // Ownership check — verify this record belongs to the authenticated client
  const companyName = client.fields.company_name;
  const escapedName = escapeAirtableString(companyName);
  const ownerCheck = await contentAirtableFetch<{ id: string }>(CONTENT_JOBS_TABLE, {
    filterByFormula: `AND(RECORD_ID()="${record_id}",FIND("${escapedName}",ARRAYJOIN({Client Name (from Client ID)},",")))`,
    maxRecords: 1,
  });
  if (!ownerCheck[0]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { title_status: "skipped" });

  return NextResponse.json({ ok: true });
}
