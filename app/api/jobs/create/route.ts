import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { airtableFetch, airtablePatch } from "@/lib/airtable";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const auth = request.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.ADMIN_PASSWORD}`) return true;
  const session = await getSession();
  return !!session;
}

export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    sop_name?: string;
    client_id?: string;
    payload?: Record<string, unknown>;
    runner?: "vercel" | "fly";
    parent_job_id?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sop_name, client_id, payload = {}, runner = "fly", parent_job_id } = body;

  if (!sop_name) {
    return NextResponse.json({ error: "sop_name is required" }, { status: 400 });
  }

  // Auto-generate portal token when an audit_parent job is created for a client
  if (sop_name === "audit_parent" && client_id) {
    try {
      const records = await airtableFetch<{ id: string; fields: { portal_token?: string } }>(
        "Clients",
        { filterByFormula: `RECORD_ID()="${client_id}"`, maxRecords: 1 }
      );
      const client = records[0];
      if (client && !client.fields.portal_token) {
        const token = crypto.randomUUID();
        await airtablePatch("Clients", client_id, { portal_token: token });
      }
    } catch (e) {
      // Non-fatal — log and continue so the job still gets created
      console.error("[jobs/create] portal token auto-gen failed:", e);
    }
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      sop_name,
      client_id: client_id ?? null,
      payload,
      status: "pending",
      runner,
      parent_job_id: parent_job_id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
