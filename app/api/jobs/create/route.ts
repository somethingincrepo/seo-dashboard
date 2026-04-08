import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
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
