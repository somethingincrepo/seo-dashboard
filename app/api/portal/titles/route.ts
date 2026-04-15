import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { contentAirtableFetch, contentAirtablePatch, contentAirtableCreate } from "@/lib/airtable";
import { PACKAGES, type PackageTier } from "@/lib/packages";

function startOfMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function getMonthlyArticleLimit(pkg: PackageTier): number {
  const p = PACKAGES[pkg];
  return p.articles_standard + p.articles_longform;
}

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

  // Monthly quota info
  const pkg = ((client.fields as Record<string, unknown>).package ?? "growth") as PackageTier;
  const monthlyLimit = getMonthlyArticleLimit(pkg);
  const monthStart = startOfMonthISO();
  const monthlyApproved = titles.filter(
    (t) => t.title_status === "approved" && t.approved_at && t.approved_at >= monthStart
  ).length;

  return NextResponse.json({ titles, keyword_groups: keywordGroups, monthly_approved: monthlyApproved, monthly_limit: monthlyLimit });
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

  // Monthly quota check — block if already at package limit
  if (action === "approve") {
    const pkg = ((client.fields as Record<string, unknown>).package ?? "growth") as PackageTier;
    const monthlyLimit = getMonthlyArticleLimit(pkg);
    const monthStart = startOfMonthISO();
    const companyName = client.fields.company_name;
    const allJobs = await contentAirtableFetch<{ id: string; fields: { title_status?: string; approved_at?: string } }>(
      CONTENT_JOBS_TABLE,
      {
        filterByFormula: `AND(FIND("${companyName}",ARRAYJOIN({Client Name (from Client ID)},",")),{title_status}="approved")`,
        fields: ["title_status", "approved_at"],
      }
    );
    const approvedThisMonth = allJobs.filter(
      (j) => j.fields.approved_at && j.fields.approved_at >= monthStart
    ).length;
    if (approvedThisMonth >= monthlyLimit) {
      return NextResponse.json({
        error: "quota_reached",
        message: `You've approved ${approvedThisMonth} of ${monthlyLimit} articles for this month. Your ${pkg} plan includes ${monthlyLimit} articles/month.`,
        quota_reached: true,
        monthly_approved: approvedThisMonth,
        monthly_limit: monthlyLimit,
      }, { status: 409 });
    }
  }

  const fields: Record<string, unknown> = {};

  if (action === "approve") {
    fields.title_status = "approved";
    fields.approved_at = new Date().toISOString();
    fields.Status = "Queued";
  }

  if (title?.trim()) fields["Blog Title"] = title.trim();
  if (target_keyword !== undefined) fields.target_keyword = target_keyword;
  if (keyword_group !== undefined) fields.keyword_group = keyword_group;

  // For approval, fetch the current record first so we can send the right payload to n8n
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

  // Fire n8n webhook with the payload format the workflow actually expects.
  // Content type and Desired length range are hardcoded defaults since the portal
  // doesn't collect them — the n8n Article Drafting node needs them to avoid .name errors.
  // If the webhook fails, mark the job "Webhook Failed" in Airtable so it's visible.
  if (action === "approve") {
    const webhookUrl = process.env.N8N_CONTENT_WEBHOOK_URL || "https://somethingincorporated.app.n8n.cloud/webhook/status-update";
    const blogTitle = title?.trim() || jobRecord?.fields["Blog Title"] || "";
    const clientIds = (jobRecord?.fields["Client ID"] ?? []).map((id) => ({ id }));
    const searchIntent = jobRecord?.fields["Search intent"] || "informational";
    try {
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: record_id,
          fields: {
            "Blog Title": blogTitle,
            "Client ID": clientIds,
            "Search intent": searchIntent,
            "Content type": { id: "Blog Post", name: "Blog Post" },
            "Desired length range": "1,500-2,500 words",
          },
        }),
      });
      if (!webhookRes.ok) {
        await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { Status: "Webhook Failed" });
      }
    } catch {
      await contentAirtablePatch(CONTENT_JOBS_TABLE, record_id, { Status: "Webhook Failed" }).catch(() => {});
    }
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
