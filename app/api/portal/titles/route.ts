import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { contentAirtableFetch, contentAirtablePatch, contentAirtableCreate } from "@/lib/airtable";

const CONTENT_JOBS_TABLE = "Content Jobs";
const CONTENT_CLIENTS_TABLE = "Clients";

export const dynamic = "force-dynamic";

async function getContentClientId(companyName: string): Promise<string | null> {
  const records = await contentAirtableFetch<{ id: string }>(
    CONTENT_CLIENTS_TABLE,
    { filterByFormula: `{Client Name}="${companyName}"` }
  );
  return records[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// GET — fetch titles + keyword_groups for this portal client
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

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

  if (!companyName) return NextResponse.json({ titles: [], keyword_groups: keywordGroups });

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
    };
  }>(CONTENT_JOBS_TABLE, {
    // Fetch everything except skipped so the folder nav can show all stages
    filterByFormula: `AND(
      FIND("${companyName}", ARRAYJOIN({Client Name (from Client ID)}, ",")),
      {title_status}!="skipped"
    )`,
    sort: [{ field: "proposed_at", direction: "desc" }],
    maxRecords: 200,
  });

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
  }));

  return NextResponse.json({ titles, keyword_groups: keywordGroups });
}

// ---------------------------------------------------------------------------
// POST — create a custom title
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as {
    title?: string;
    target_keyword?: string;
    keyword_group?: string;
    search_intent?: string;
  };

  const { title, target_keyword, keyword_group, search_intent } = body;
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

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

  return NextResponse.json({
    ok: true,
    id: created.id,
    title: {
      id: created.id,
      title: title.trim(),
      title_status: "titled",
      target_keyword: target_keyword ?? "",
      keyword_group: keyword_group ?? "",
      search_intent: search_intent ?? "",
      content_angle: "",
      quality_score: null,
      proposed_at: new Date().toISOString(),
      approved_at: null,
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH — approve (with optional title/keyword/group edits)
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as {
    record_id?: string;
    title?: string;
    target_keyword?: string;
    keyword_group?: string;
    action?: "approve" | "save";
  };
  const { record_id, title, target_keyword, keyword_group, action = "approve" } = body;

  if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });

  const fields: Record<string, unknown> = {};

  if (action === "approve") {
    fields.title_status = "approved";
    fields.approved_at = new Date().toISOString();
    fields.Status = "Queued";
  }

  if (title?.trim()) fields["Blog Title"] = title.trim();
  if (target_keyword !== undefined) fields.target_keyword = target_keyword;
  if (keyword_group !== undefined) fields.keyword_group = keyword_group;

  await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, fields);

  // Fire-and-forget n8n webhook — do NOT await, Airtable Status=Queued is the reliable trigger
  if (action === "approve") {
    const webhookUrl = process.env.N8N_CONTENT_WEBHOOK_URL || "https://somethingincorporated.app.n8n.cloud/webhook/42b82c45-bb9e-4597-a0df-2b9ab9b2863f";
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id, trigger: "portal_approval" }),
    }).catch(() => {/* non-fatal */});
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// DELETE — skip/reject a title
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as { record_id?: string };
  const { record_id } = body;

  if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });

  await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { title_status: "skipped" });

  return NextResponse.json({ ok: true });
}
