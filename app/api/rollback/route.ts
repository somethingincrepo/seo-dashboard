import { NextRequest, NextResponse } from "next/server";
import { airtableFetch, airtablePatch } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

type ChangeRecord = {
  id: string;
  fields: {
    execution_status: string;
    revert_payload?: string;
    client_id?: string[];
    type?: string;
  };
};

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

    // Load the change record
    const records = await airtableFetch<ChangeRecord>("Changes", {
      filterByFormula: `RECORD_ID()="${changeId}"`,
      fields: ["execution_status", "revert_payload", "client_id", "type"],
      maxRecords: 1,
    });

    if (!records.length) {
      return NextResponse.json({ error: "Change not found" }, { status: 404 });
    }

    const change = records[0];
    const { execution_status, revert_payload, client_id } = change.fields;

    if (execution_status !== "complete") {
      return NextResponse.json(
        {
          error:
            execution_status === "reverted"
              ? "This change has already been reverted."
              : execution_status === "reverting"
              ? "A revert is already in progress for this change."
              : `Cannot revert — execution_status is "${execution_status}". Only completed changes can be reverted.`,
        },
        { status: 409 }
      );
    }

    if (!revert_payload?.trim()) {
      return NextResponse.json(
        {
          error:
            "No revert_payload found. This change was implemented before the revert system was in place — manual revert required.",
        },
        { status: 422 }
      );
    }

    const clientId = client_id?.[0];

    // Insert Supabase rollback job (picked up by Fly.io worker)
    const supabase = getSupabase();
    await supabase.from("jobs").insert({
      sop_name: "rollback",
      runner: "fly",
      client_id: clientId ?? null,
      status: "pending",
      payload: { change_id: changeId },
    });

    // Optimistically mark as reverting (the rollback SOP also does this, but doing it
    // here gives the UI instant feedback before the worker picks up the job)
    await airtablePatch("Changes", changeId, {
      execution_status: "reverting",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Rollback trigger failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
