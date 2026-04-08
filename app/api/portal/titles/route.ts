import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { contentAirtableFetch, contentAirtablePatch } from "@/lib/airtable";

const CONTENT_JOBS_TABLE = "Content Jobs";
const CONTENT_CLIENTS_TABLE = "Clients";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — fetch pending titles for this portal client
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const companyName = client.fields.company_name;

  // Find the content base client record
  const contentClients = await contentAirtableFetch<{ id: string; fields: { "Client Name": string } }>(
    CONTENT_CLIENTS_TABLE,
    { filterByFormula: `{Client Name}="${companyName}"` }
  );

  if (!contentClients.length) {
    return NextResponse.json({ titles: [] });
  }

  const contentClientId = contentClients[0].id;

  // Fetch titled (pending approval) and approved jobs for this client
  const jobs = await contentAirtableFetch<{
    id: string;
    fields: {
      "Blog Title": string;
      title_status: string;
      target_keyword: string;
      keyword_group: string;
      "Search intent": string;
      content_angle: string;
      quality_score: number;
      proposed_at: string;
      approved_at: string;
    };
  }>(CONTENT_JOBS_TABLE, {
    filterByFormula: `AND(
      FIND("${contentClientId}", ARRAYJOIN({Client ID}, ",")),
      OR({title_status}="titled", {title_status}="approved")
    )`,
    sort: [{ field: "proposed_at", direction: "desc" }],
    maxRecords: 50,
  });

  const titles = jobs.map((j) => ({
    id: j.id,
    title: j.fields["Blog Title"] ?? "",
    title_status: j.fields.title_status ?? "titled",
    target_keyword: j.fields.target_keyword ?? "",
    keyword_group: j.fields.keyword_group ?? "",
    search_intent: j.fields["Search intent"] ?? "",
    content_angle: j.fields.content_angle ?? "",
    quality_score: j.fields.quality_score ?? null,
    proposed_at: j.fields.proposed_at ?? null,
    approved_at: j.fields.approved_at ?? null,
  }));

  return NextResponse.json({ titles });
}

// ---------------------------------------------------------------------------
// PATCH — approve (with optional title edit)
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as { record_id?: string; title?: string };
  const { record_id, title } = body;

  if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });

  const fields: Record<string, unknown> = {
    title_status: "approved",
    approved_at: new Date().toISOString(),
    Status: "Queued", // triggers n8n content pipeline
  };

  if (title && title.trim()) {
    fields["Blog Title"] = title.trim();
  }

  await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, fields);

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
