import { getPendingApprovals } from "@/lib/changes";
import { getClients } from "@/lib/clients";
import { getSupabase } from "@/lib/supabase";
import type { SupabaseJob } from "@/lib/supabase";
import { airtableFetch } from "@/lib/airtable";
import { ActivityView } from "./ActivityView";

export const dynamic = "force-dynamic";

// ─── Types passed to ActivityView ────────────────────────────────────────────

export type ApprovalItem = {
  kind: "approval";
  id: string;
  clientRecordId: string;
  changeType: string;
  cat: string;
  pageUrl: string;
  proposedValue: string;
  reasoning: string;
  confidence: string;
  tier: string;
  changeTitle: string;
};

export type JobItem = {
  kind: "job";
  id: string;
  clientSlug: string;
  sopName: string;
  status: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  error: string | null;
};

export type RevertItem = {
  kind: "revert";
  id: string;
  clientRecordId: string;
  changeType: string;
  cat: string;
  pageUrl: string;
  currentValue: string;
  proposedValue: string;
  executionStatus: string;
  implementedAt: string | null;
  revertedAt: string | null;
  revertNote: string | null;
  hasRevertPayload: boolean;
  changeTitle: string;
  cms: string;
};

export type ClientInfo = {
  recordId: string;   // Airtable record ID — for approvals + reverts
  slug: string;       // fields.client_id slug — for Supabase jobs
  name: string;
};

// ─── Data fetch ──────────────────────────────────────────────────────────────

type ImplementedChange = {
  id: string;
  fields: {
    type: string;
    cat: string;
    page_url: string;
    current_value: string;
    proposed_value: string;
    change_title: string;
    execution_status: string;
    implemented_at?: string;
    reverted_at?: string;
    revert_payload?: string;
    revert_note?: string;
    client_id?: string[];
    cms?: string;
  };
};

export default async function ActivityPage() {
  const [clients, approvals, supabaseJobs, revertChanges] = await Promise.all([
    getClients(),

    getPendingApprovals(),

    getSupabase()
      .from("jobs")
      .select("id, sop_name, client_id, status, input_tokens, output_tokens, cost_usd, created_at, error")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => (data ?? []) as Pick<
        SupabaseJob,
        "id" | "sop_name" | "client_id" | "status" | "input_tokens" | "output_tokens" | "cost_usd" | "created_at" | "error"
      >[]),

    airtableFetch<ImplementedChange>("Changes", {
      filterByFormula: `OR({execution_status}="complete",{execution_status}="reverting",{execution_status}="reverted",{execution_status}="revert_failed")`,
      sort: [{ field: "implemented_at", direction: "desc" }],
      maxRecords: 200,
    }),
  ]);

  // ── Client lookup maps ────────────────────────────────────────────────────
  const clientInfos: ClientInfo[] = clients.map((c) => ({
    recordId: c.id,
    slug: c.fields.client_id,
    name: c.fields.company_name,
  }));

  const byRecordId = new Map<string, ClientInfo>(clientInfos.map((c) => [c.recordId, c]));
  const bySlug = new Map<string, ClientInfo>(clientInfos.map((c) => [c.slug, c]));

  // ── Serialize approvals ───────────────────────────────────────────────────
  const approvalItems: ApprovalItem[] = approvals.map((a) => ({
    kind: "approval",
    id: a.id,
    clientRecordId: a.fields.client_id?.[0] ?? "",
    changeType: a.fields.type ?? "",
    cat: a.fields.cat ?? "",
    pageUrl: a.fields.page_url ?? "",
    proposedValue: a.fields.proposed_value ?? "",
    reasoning: a.fields.reasoning ?? "",
    confidence: a.fields.confidence ?? "",
    tier: a.fields.implementation_tier ?? "",
    changeTitle: a.fields.change_title ?? "",
  }));

  // ── Serialize jobs ────────────────────────────────────────────────────────
  const jobItems: JobItem[] = supabaseJobs.map((j) => ({
    kind: "job",
    id: j.id,
    clientSlug: j.client_id ?? "",
    sopName: j.sop_name,
    status: j.status,
    costUsd: j.cost_usd ?? 0,
    inputTokens: j.input_tokens ?? 0,
    outputTokens: j.output_tokens ?? 0,
    createdAt: j.created_at,
    error: j.error ?? null,
  }));

  // ── Serialize reverts ─────────────────────────────────────────────────────
  const revertItems: RevertItem[] = revertChanges.map((r) => ({
    kind: "revert",
    id: r.id,
    clientRecordId: r.fields.client_id?.[0] ?? "",
    changeType: r.fields.type ?? "",
    cat: r.fields.cat ?? "",
    pageUrl: r.fields.page_url ?? "",
    currentValue: r.fields.current_value ?? "",
    proposedValue: r.fields.proposed_value ?? "",
    executionStatus: r.fields.execution_status ?? "",
    implementedAt: r.fields.implemented_at ?? null,
    revertedAt: r.fields.reverted_at ?? null,
    revertNote: r.fields.revert_note ?? null,
    hasRevertPayload: !!r.fields.revert_payload?.trim(),
    changeTitle: r.fields.change_title ?? "",
    cms: r.fields.cms ?? "",
  }));

  // ── Build client list for filter (only those with actual data) ────────────
  const activeClientIds = new Set([
    ...approvalItems.map((a) => a.clientRecordId),
    ...jobItems.map((j) => bySlug.get(j.clientSlug)?.recordId ?? ""),
    ...revertItems.map((r) => r.clientRecordId),
  ]);
  activeClientIds.delete("");

  const filterClients = clientInfos
    .filter((c) => activeClientIds.has(c.recordId))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ActivityView
      approvals={approvalItems}
      jobs={jobItems}
      reverts={revertItems}
      clients={filterClients}
      byRecordId={Object.fromEntries(byRecordId)}
      bySlug={Object.fromEntries(bySlug)}
    />
  );
}
