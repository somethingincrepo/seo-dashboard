import { getJobs } from "@/lib/jobs";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const JOB_TYPE_LABELS: Record<string, string> = {
  onboarding_setup: "Onboarding Setup",
  month1_audit: "Month 1 Audit",
  month1_implement: "Month 1 Implement",
  ongoing_implement: "Implement Change",
  ongoing_publish: "Publish SEO",
  ongoing_monthly: "Monthly Review",
  report_generate: "Generate Report",
};

export default async function JobsPage() {
  const jobs = await getJobs(100);

  const queued = jobs.filter((j) => j.fields.job_status === "queued");
  const running = jobs.filter((j) => ["running", "implementing"].includes(j.fields.job_status));
  const done = jobs.filter((j) => ["complete", "failed"].includes(j.fields.job_status));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-slate-500 text-sm mt-1">
          {queued.length} queued · {running.length} running · {done.length} completed
        </p>
      </div>

      {running.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">Running</h2>
          <JobTable jobs={running} />
        </section>
      )}

      {queued.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">Queued</h2>
          <JobTable jobs={queued} />
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">History</h2>
        <JobTable jobs={done} />
      </section>
    </div>
  );
}

function JobTable({ jobs }: { jobs: Awaited<ReturnType<typeof getJobs>> }) {
  if (jobs.length === 0) {
    return (
      <GlassCard>
        <div className="px-5 py-8 text-center text-slate-400 text-sm">None</div>
      </GlassCard>
    );
  }
  return (
    <GlassCard>
      <div className="divide-y divide-slate-100">
        {jobs.map((job) => (
          <div key={job.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {JOB_TYPE_LABELS[job.fields.type] ?? job.fields.type?.replace(/_/g, " ")}
              </div>
              <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-2">
                <span>#{job.fields.job_id}</span>
                {job.fields.started_at && (
                  <span>{new Date(job.fields.started_at).toLocaleString()}</span>
                )}
              </div>
              {job.fields.error_message && (
                <div className="text-red-400 text-xs mt-1 line-clamp-1">{job.fields.error_message}</div>
              )}
            </div>
            <StatusBadge value={job.fields.job_status} variant="job_status" />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
