import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getLatestAuditRun, getLatestCompletedRun, getIssuesForRun } from "@/lib/audit/queries";
import { AuditMasterDetail } from "@/components/portal/AuditMasterDetail";
import { AuditEmptyState } from "@/components/portal/AuditEmptyState";

export const revalidate = 0;

export default async function AuditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const recordId = client.id;
  const completedRun = await getLatestCompletedRun(recordId);
  const latestRun = completedRun ?? (await getLatestAuditRun(recordId));

  if (!latestRun) {
    return <AuditEmptyState state="never_run" />;
  }
  if (!completedRun) {
    return <AuditEmptyState state={latestRun.status === "failed" ? "failed" : "in_progress"} run={latestRun} />;
  }

  const issues = await getIssuesForRun(completedRun.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Site Audit</h1>
        <p className="text-base text-slate-500 mt-1">
          {completedRun.pages_crawled.toLocaleString()} pages crawled · {issues.length.toLocaleString()} issues found ·{" "}
          last run {formatRelative(completedRun.diagnose_completed_at ?? completedRun.created_at)}
        </p>
      </div>
      <AuditMasterDetail run={completedRun} issues={issues} />
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
