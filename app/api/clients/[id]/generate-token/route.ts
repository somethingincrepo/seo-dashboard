import { NextRequest, NextResponse } from "next/server";
import { airtablePatch } from "@/lib/airtable";
import { getSession } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const token = crypto.randomUUID();

  await airtablePatch("Clients", id, { portal_token: token });
  return NextResponse.json({ token });
}
