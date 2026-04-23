import { NextRequest, NextResponse } from "next/server";
import { airtableFetch, airtablePatch } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

type DesignReviewChange = {
  id: string;
  fields: {
    type?: string;
    page_url?: string;
    current_value?: string;
    proposed_value?: string;
    approval?: string;
    execution_status?: string;
    requires_design_review?: boolean;
    client_id?: string | string[];
    priority?: string;
    confidence?: string;
    change_title?: string;
  };
};

export async function GET(_request: NextRequest) {
  const authed = await getSession();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const changes = await airtableFetch<DesignReviewChange>("Changes", {
    filterByFormula: `AND({approval}="approved",{requires_design_review}=TRUE(),OR({execution_status}="design_review_required",{execution_status}="pending"))`,
    sort: [{ field: "priority", direction: "asc" }],
  });

  return NextResponse.json({ changes });
}

export async function POST(request: NextRequest) {
  try {
    const authed = await getSession();
    if (!authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    // Accept both camelCase (from UI) and snake_case (from API/tests)
    const changeId: string = body.changeId ?? body.change_id;
    const clientId: string | undefined = body.clientId ?? body.client_id;
    // Accept "approved"/"safe" → queue implement; "rejected"/"manual" → manual required
    const rawDecision: string = body.decision ?? "";
    const decision: "safe" | "manual" =
      rawDecision === "approved" || rawDecision === "safe"
        ? "safe"
        : rawDecision === "rejected" || rawDecision === "manual"
        ? "manual"
        : rawDecision as "safe" | "manual";

    if (!changeId || !["safe", "manual"].includes(decision)) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    if (decision === "manual") {
      try {
        await airtablePatch("Changes", changeId, {
          execution_status: "manual_required",
          client_notes: "Design review complete — marked for manual implementation.",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || msg.includes("NOT_FOUND")) {
          return NextResponse.json({ error: "Change record not found" }, { status: 404 });
        }
        throw err;
      }
      return NextResponse.json({ ok: true, outcome: "manual_required" });
    }

    // decision === "safe" — clear design review flag and create implement job
    try {
      await airtablePatch("Changes", changeId, {
        execution_status: "pending",
        client_notes: "Design review passed — queued for implementation.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("NOT_FOUND")) {
        return NextResponse.json({ error: "Change record not found" }, { status: 404 });
      }
      throw err;
    }

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
