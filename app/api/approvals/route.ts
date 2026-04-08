import { NextRequest, NextResponse } from "next/server";
import { updateApproval, revertDecision } from "@/lib/changes";
import { getClientByToken } from "@/lib/clients";
import { airtableCreate } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, decision, notes, token } = body;

    if (!recordId || !decision || !token) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validDecisions = ["approved", "skipped", "question", "undo"];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    // Verify token is valid
    const client = await getClientByToken(token);
    if (!client) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    if (decision === "undo") {
      const result = await revertDecision(recordId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ ok: true });
    }

    await updateApproval(recordId, decision, notes);

    // Queue an implement job immediately so the queue processor picks it up
    if (decision === "approved") {
      await airtableCreate("Jobs", {
        client_id: [client.id],
        job_type_new: "implement",
        job_status_new: "queued",
        triggered_by: "portal_approval",
        params: JSON.stringify({ change_id: recordId }),
      });

      // Dual-write to Supabase for visibility in the new dashboard.
      // Fire-and-forget: a Supabase failure must not break the approval flow.
      try {
        const supabase = getSupabase();
        await supabase.from("jobs").insert({
          sop_name: "implement",
          client_id: client.id,
          status: "pending",
          payload: { change_id: recordId, triggered_by: "portal_approval" },
        });
      } catch (err) {
        console.error("Supabase dual-write failed (non-fatal):", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Approval update failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
