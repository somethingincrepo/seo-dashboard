import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabase, listLogs } from "@/lib/supabase";
import type { SupabaseJob } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { LogStream } from "./LogStream";

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

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabase();

  const jobResult = await supabase.from("jobs").select("*").eq("id", id).single();

  if (jobResult.error || !jobResult.data) {
    notFound();
  }

  const job = jobResult.data as SupabaseJob;
  const logs = await listLogs(id, 0);
  const label = SOP_LABELS[job.sop_name] ?? job.sop_name.replace(/_/g, " ");

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/jobs" className="hover:text-slate-600 transition-colors">
          Jobs
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{label}</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{label}</h1>
        <p className="text-slate-400 text-xs mt-1 font-mono">{job.id}</p>
      </div>

      <GlassCard>
        <div className="p-5">
          <LogStream jobId={id} initialJob={job} initialLogs={logs} />
        </div>
      </GlassCard>

      {/* Payload — collapsed by default once there are logs */}
      {Object.keys(job.payload).length > 0 && (
        <details className="group">
          <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors">
            Payload
          </summary>
          <pre className="mt-2 bg-slate-50 rounded-lg p-4 text-xs overflow-auto border border-slate-100 text-slate-600">
            {JSON.stringify(job.payload, null, 2)}
          </pre>
        </details>
      )}

      {job.result && (
        <details>
          <summary className="text-xs text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors">
            Result
          </summary>
          <pre className="mt-2 bg-slate-50 rounded-lg p-4 text-xs overflow-auto border border-slate-100 text-slate-600">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
