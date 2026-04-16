import { NextRequest, NextResponse } from "next/server";
import { updateApproval, revertDecision } from "@/lib/changes";
import { getClientByToken } from "@/lib/clients";
import { airtableCreate, airtableFetch, airtablePatch } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";
import { PACKAGES, type PackageTier, type PackageDeliverables } from "@/lib/packages";
import { submitUrlToIndexingAPI } from "@/lib/tools/google-indexing";

// Change types that consume a monthly quota slot
const TYPE_QUOTAS: Record<string, keyof PackageDeliverables> = {
  "Internal Link":  "internal_links",
  "Internal Links": "internal_links",
};

function startOfMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

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

    if (decision === "approved") {
      // Three-gate check before dispatching implement job
      type ChangeRecord = { id: string; fields: { auto_executable?: boolean; requires_design_review?: boolean; type?: string; page_url?: string } };
      const changeRecords = await airtableFetch<ChangeRecord>("Changes", {
        filterByFormula: `RECORD_ID()="${recordId}"`,
        fields: ["auto_executable", "requires_design_review", "type", "page_url"],
        maxRecords: 1,
      });
      const changeFields = changeRecords[0]?.fields ?? {};

      // ── Monthly quota check ──────────────────────────────────────────────────
      const changeType = changeFields.type ?? "";
      const deliverableKey = TYPE_QUOTAS[changeType];
      if (deliverableKey) {
        const pkg = ((client.fields as Record<string, unknown>).package ?? "growth") as PackageTier;
        const monthlyLimit = PACKAGES[pkg][deliverableKey] as number;
        if (monthlyLimit > 0) {
          const clientId = (client.fields as Record<string, unknown>).client_id as string || client.id;
          const monthStart = startOfMonthISO();
          const approvedSoFar = await airtableFetch<{ id: string }>("Changes", {
            filterByFormula: `AND(OR(FIND("${clientId}",{client_id}),FIND("${client.id}",{client_id})),{type}="${changeType}",{approval}="approved",IS_AFTER({approved_at},"${monthStart}"))`,
            fields: ["id" as never],
          });
          if (approvedSoFar.length >= monthlyLimit) {
            return NextResponse.json({
              error: "quota_reached",
              message: `Monthly ${changeType} limit reached (${monthlyLimit}/${monthlyLimit}). No more ${changeType} changes can be approved this month.`,
              quota_reached: true,
              limit: monthlyLimit,
              used: approvedSoFar.length,
            }, { status: 409 });
          }
        }
      }
      // ────────────────────────────────────────────────────────────────────────
      const autoExecutable = changeFields.auto_executable !== false; // default true if not set
      const requiresDesignReview = changeFields.requires_design_review === true;

      // Gate 1: API capability
      if (!autoExecutable) {
        await airtablePatch("Changes", recordId, { execution_status: "manual_required" });
        return NextResponse.json({ ok: true, queued: false, outcome: "manual_required" });
      }

      // Gate 2: Design safety
      if (requiresDesignReview) {
        await airtablePatch("Changes", recordId, { execution_status: "design_review_required" });
        return NextResponse.json({ ok: true, queued: false, outcome: "design_review_required" });
      }

      // Both gates passed — queue implement job
      await airtableCreate("Jobs", {
        client_id: (client.fields as { client_id: string }).client_id,
        job_type_new: "implement",
        job_status_new: "queued",
        triggered_by: "portal_approval",
        params: JSON.stringify({ change_id: recordId }),
      });

      // Write to Supabase — picked up by the Fly.io worker's implement SOP.
      // runner='fly' is required: implement is a long-running job that needs the worker, not Vercel.
      try {
        const supabase = getSupabase();
        await supabase.from("jobs").insert({
          sop_name: "implement",
          runner: "fly",
          client_id: client.id,
          status: "pending",
          payload: { change_id: recordId, triggered_by: "portal_approval" },
        });
      } catch (err) {
        console.error("Supabase job insert failed (non-fatal):", err);
      }

      // Fire-and-forget: submit the page URL to Google Indexing API so Google
      // crawls it as soon as the implementation goes live.
      const pageUrl = changeFields.page_url as string | undefined;
      if (pageUrl) {
        submitUrlToIndexingAPI(pageUrl).then((result) => {
          const status = "error" in result ? "failed" : "submitted";
          airtablePatch("Changes", recordId, {
            indexing_status: status,
            indexing_submitted_at: new Date().toISOString(),
          }).catch(() => {});
        }).catch(() => {});
      }

      return NextResponse.json({ ok: true, queued: true, outcome: "queued" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Approval update failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
