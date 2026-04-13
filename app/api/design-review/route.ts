import { NextRequest, NextResponse } from "next/server";
import { airtablePatch } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { getClients } from "@/lib/clients";

export async function POST(request: NextRequest) {
  try {
    // Admin auth check
    const authed = await getSession();
    if (!authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { changeId, decision, clientId } = body as {
      changeId: string;
      decision: "safe" | "manual";
      clientId?: string;
    };

    if (!changeId || !decision || !["safe", "manual"].includes(decision)) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    if (decision === "manual") {
      await airtablePatch("Changes", changeId, {
        execution_status: "manual_required",
        client_notes: "Design review complete — marked for manual implementation.",
      });
      return NextResponse.json({ ok: true, outcome: "manual_required" });
    }

    // decision === "safe" — create implement job
    await airtablePatch("Changes", changeId, {
      execution_status: "pending",
      client_notes: "Design review passed — queued for implementation.",
    });

    // Insert Supabase job (picked up by Fly.io worker)
    if (clientId) {
      try {
        const supabase = getSupabase();
        await supabase.from("jobs").insert({
          sop_name: "implement",
          runner: "fly",
          client_id: clientId,
          status: "pending",
          payload: { change_id: changeId, triggered_by: "design_review" },
        });
      } catch (err) {
        console.error("Supabase job insert failed (non-fatal):", err);
      }
    }

    return NextResponse.json({ ok: true, outcome: "queued" });
  } catch (err) {
    console.error("Design review action failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
