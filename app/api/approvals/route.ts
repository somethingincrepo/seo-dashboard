import { NextRequest, NextResponse } from "next/server";
import { updateApproval, revertDecision } from "@/lib/changes";
import { getClientByToken } from "@/lib/clients";
import { airtableCreate, airtableFetch, airtablePatch } from "@/lib/airtable";
import { getSupabase } from "@/lib/supabase";
import { PACKAGES, type PackageTier, type PackageDeliverables } from "@/lib/packages";
import { submitUrlToIndexingAPI } from "@/lib/tools/google-indexing";
import { requirePortalAuth } from "@/lib/portal-auth";

// Change types that consume a monthly quota slot
const TYPE_QUOTAS: Record<string, keyof PackageDeliverables> = {
  "Internal Link":      "internal_links",
  "Internal Links":     "internal_links",
  "Page Optimization":  "pages_optimized",
};

function startOfMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { recordId, decision, notes, token } = body as { recordId: string; decision: string; notes?: string; token: string };

    if (!recordId || !decision || !token) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validDecisions = ["approved", "skipped", "question", "undo"];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    // Require active portal session or admin session
    const authErr = await requirePortalAuth(token);
    if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

    // Verify token is valid
    const client = await getClientByToken(token);
    if (!client) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    // Fetch change record upfront — needed for ownership check and gate logic
    type ChangeRecord = { id: string; fields: { client_id?: string; auto_executable?: boolean; requires_design_review?: boolean; type?: string; page_url?: string } };
    const changeRecords = await airtableFetch<ChangeRecord>("Changes", {
      filterByFormula: `RECORD_ID()="${recordId}"`,
      fields: ["client_id", "auto_executable", "requires_design_review", "type", "page_url"],
      maxRecords: 1,
    });
    if (!changeRecords[0]) {
      return NextResponse.json({ error: "Change not found" }, { status: 404 });
    }
    const changeFields = changeRecords[0].fields;

    // Ownership check — client_id in Changes is a plain text field storing a record ID or slug
    const clientSlug = (client.fields as Record<string, unknown>).client_id as string | undefined;
    const changeOwner = changeFields.client_id;
    if (changeOwner && changeOwner !== clientSlug && changeOwner !== client.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (decision === "undo") {
      const result = await revertDecision(recordId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ ok: true });
    }

    if (decision === "approved") {
      // ── Monthly quota check (before writing anything) ──────────────────────
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
      // ───────────────────────────────────────────────────────────────────────

      // Determine gate outcome before any writes so approval + execution_status
      // are written atomically — no partial state if the patch fails.
      const autoExecutable = changeFields.auto_executable === true;
      const requiresDesignReview = changeFields.requires_design_review === true;

      let executionStatus: string;
      if (!autoExecutable) {
        executionStatus = "manual_required";
      } else if (requiresDesignReview) {
        executionStatus = "design_review_required";
      } else {
        executionStatus = "pending";
      }

      const approvalFields: Record<string, unknown> = {
        approval: "approved",
        approved_at: new Date().toISOString(),
        execution_status: executionStatus,
      };
      if (notes) approvalFields.client_notes = notes;
      await airtablePatch("Changes", recordId, approvalFields);

      if (executionStatus === "manual_required") {
        return NextResponse.json({ ok: true, queued: false, outcome: "manual_required" });
      }

      if (executionStatus === "design_review_required") {
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

    // skipped / question — no quota check needed, just write the decision
    await updateApproval(recordId, decision as "skipped" | "question", notes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Approval update failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
