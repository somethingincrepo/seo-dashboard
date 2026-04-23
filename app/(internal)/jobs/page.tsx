import Link from "next/link";
import { getJobs } from "@/lib/jobs";
import { listJobs } from "@/lib/supabase";
import type { SupabaseJob } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const SOP_LABELS: Record<string, string> = {
  implement: "Implement Change",
  month1_audit: "Month 1 Audit",
  month1_implement: "Month 1 Implement",
  ongoing_implement: "Implement Change",
  ongoing_publish: "Publish SEO",
  ongoing_monthly: "Monthly Review",
  report_generate: "Generate Report",
  onboarding_setup: "Onboarding Setup",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-slate-400",
  claimed: "text-blue-500",
  running: "text-blue-600",
  done: "text-green-600",
  failed: "text-red-500",
};

// Airtable job type labels (legacy section)
const JOB_TYPE_LABELS: Record<string, string> = {
  onboarding_setup: "Onboarding Setup",
  month1_audit: "Month 1 Audit",
  month1_implement: "Month 1 Implement",
  ongoing_implement: "Implement Change",
  ongoing_publish: "Publish SEO",
  ongoing_monthly: "Monthly Review",
  report_generate: "Generate Report",
};

async function getSupabaseJobs(): Promise<SupabaseJob[]> {
  try {
    return await listJobs(100);
  } catch (err) {
    console.error("Supabase jobs fetch failed:", err);
    return [];
  }
}

export default async function JobsPage() {
  const [supabaseJobs, airtableJobs] = await Promise.all([
    getSupabaseJobs(),
    getJobs(100),
  ]);

  const sbPending = supabaseJobs.filter((j) => j.status === "pending");
  const sbActive = supabaseJobs.filter((j) => ["claimed", "running"].includes(j.status));
  const sbDone = supabaseJobs.filter((j) => ["done", "failed"].includes(j.status));

  const atQueued = airtableJobs.filter((j) => j.fields.job_status === "queued");
  const atRunning = airtableJobs.filter((j) =>
    ["running", "implementing"].includes(j.fields.job_status)
  );
  const atDone = airtableJobs.filter((j) =>
    ["complete", "failed"].includes(j.fields.job_status)
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Jobs</h1>
      </div>

      {/* ── Supabase jobs (new runner + VPS reporting) ── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider">
            Live Jobs
          </h2>
          <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-2 py-0.5 font-medium">
            New Runner
          </span>
        </div>

        {supabaseJobs.length === 0 ? (
          <GlassCard>
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              No jobs yet — will populate once VPS reporting is deployed.
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {sbActive.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Running</p>
                <SupabaseJobTable jobs={sbActive} />
              </div>
            )}
            {sbPending.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Pending</p>
                <SupabaseJobTable jobs={sbPending} />
              </div>
            )}
            {sbDone.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Completed</p>
                <SupabaseJobTable jobs={sbDone} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Airtable jobs ── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider">
            Airtable Jobs
          </h2>
        </div>

        {atRunning.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Running</p>
            <AirtableJobTable jobs={atRunning} />
          </div>
        )}
        {atQueued.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Queued</p>
            <AirtableJobTable jobs={atQueued} />
          </div>
        )}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">History</p>
          <AirtableJobTable jobs={atDone} />
        </div>
      </section>
    </div>
  );
}

function SupabaseJobTable({ jobs }: { jobs: SupabaseJob[] }) {
  if (jobs.length === 0) {
    return (
      <GlassCard>
        <div className="px-5 py-6 text-center text-slate-400 text-sm">None</div>
      </GlassCard>
    );
  }
  return (
    <GlassCard>
      <div className="divide-y divide-slate-100">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {SOP_LABELS[job.sop_name] ?? job.sop_name.replace(/_/g, " ")}
              </div>
              <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-2">
                {job.client_id && <span>{job.client_id}</span>}
                <span>{new Date(job.created_at).toLocaleString()}</span>
                {job.cost_usd > 0 && (
                  <span className="text-slate-300">
                    ${job.cost_usd.toFixed(4)}
                  </span>
                )}
              </div>
              {job.error && (
                <div className="text-red-400 text-xs mt-1 line-clamp-1">{job.error}</div>
              )}
            </div>
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${STATUS_COLOR[job.status] ?? "text-slate-400"}`}
            >
              {job.status}
            </span>
          </Link>
        ))}
      </div>
    </GlassCard>
  );
}

function AirtableJobTable({ jobs }: { jobs: Awaited<ReturnType<typeof getJobs>> }) {
  if (jobs.length === 0) {
    return (
      <GlassCard>
        <div className="px-5 py-6 text-center text-slate-400 text-sm">None</div>
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
                <div className="text-red-400 text-xs mt-1 line-clamp-1">
                  {job.fields.error_message}
                </div>
              )}
            </div>
            <StatusBadge value={job.fields.job_status} variant="job_status" />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
