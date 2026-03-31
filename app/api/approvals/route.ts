import { NextRequest, NextResponse } from "next/server";
import { updateApproval } from "@/lib/changes";
import { getClientByToken } from "@/lib/clients";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, decision, notes, token } = body;

    if (!recordId || !decision || !token) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["approved", "skipped", "question"].includes(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    // Verify token is valid
    const client = await getClientByToken(token);
    if (!client) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    await updateApproval(recordId, decision, notes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Approval update failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
