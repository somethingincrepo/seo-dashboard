import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resetChange } from "@/lib/changes";

export async function POST(request: NextRequest) {
  try {
    const authed = await getSession();
    if (!authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { changeId } = body as { changeId: string };

    if (!changeId) {
      return NextResponse.json({ error: "Missing changeId" }, { status: 400 });
    }

    const result = await resetChange(changeId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reset change failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
