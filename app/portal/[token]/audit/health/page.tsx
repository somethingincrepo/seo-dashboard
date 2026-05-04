import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { getLatestAuditRun, getLatestCompletedRun, getIssuesForRun } from "@/lib/audit/queries";
import { AuditEmptyState } from "@/components/portal/AuditEmptyState";
import { SiteHealthBoard } from "@/components/portal/SiteHealthBoard";

export const revalidate = 0;

export default async function SiteHealthPage({ params }: { params: Promise<{ token: string }> }) {
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Site Health</h1>
        <p className="text-base text-slate-500 mt-1">
          Foundational signals every site should have in place. The page-level issues from this audit live under{" "}
          <a className="text-indigo-600 hover:underline" href={`/portal/${token}/audit`}>Issues</a>.
        </p>
      </div>
      <SiteHealthBoard token={token} run={completedRun} issues={issues} />
    </div>
  );
}
