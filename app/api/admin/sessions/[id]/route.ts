import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { revokeSession } from "@/lib/portal-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await revokeSession(id);
  return NextResponse.json({ ok: true });
}
