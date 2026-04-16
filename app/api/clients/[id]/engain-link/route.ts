import { NextRequest, NextResponse } from "next/server";
import { airtablePatch } from "@/lib/airtable";
import { getSession } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { engain_project_id } = body as { engain_project_id: string | null };

  await airtablePatch("Clients", id, {
    engain_project_id: engain_project_id ?? "",
  });

  return NextResponse.json({ ok: true });
}
