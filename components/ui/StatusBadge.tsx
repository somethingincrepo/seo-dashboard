import { cn } from "@/lib/utils";

const PLAN_STATUS: Record<string, string> = {
  form_submitted: "bg-slate-500/30 text-slate-300 border-slate-400/20",
  onboarding_setup: "bg-blue-500/25 text-blue-300 border-blue-400/20",
  month1_audit: "bg-indigo-500/25 text-indigo-300 border-indigo-400/20",
  awaiting_approval: "bg-amber-500/25 text-amber-300 border-amber-400/20",
  month1_implementing: "bg-violet-500/25 text-violet-300 border-violet-400/20",
  active: "bg-emerald-500/25 text-emerald-300 border-emerald-400/20",
  paused: "bg-slate-500/25 text-slate-400 border-slate-400/20",
  failed: "bg-red-500/25 text-red-300 border-red-400/20",
};

const JOB_STATUS: Record<string, string> = {
  queued: "bg-slate-500/25 text-slate-300 border-slate-400/20",
  running: "bg-blue-500/25 text-blue-300 border-blue-400/20 animate-pulse",
  implementing: "bg-violet-500/25 text-violet-300 border-violet-400/20 animate-pulse",
  awaiting_approval: "bg-amber-500/25 text-amber-300 border-amber-400/20",
  complete: "bg-emerald-500/25 text-emerald-300 border-emerald-400/20",
  failed: "bg-red-500/25 text-red-300 border-red-400/20",
};

const CONFIDENCE: Record<string, string> = {
  High: "bg-emerald-500/20 text-emerald-300 border-emerald-400/20",
  Medium: "bg-amber-500/20 text-amber-300 border-amber-400/20",
  Low: "bg-red-500/20 text-red-300 border-red-400/20",
};

const APPROVAL: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300 border-amber-400/20",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-400/20",
  skipped: "bg-slate-500/20 text-slate-400 border-slate-400/20",
  question: "bg-blue-500/20 text-blue-300 border-blue-400/20",
  backlog: "bg-slate-600/20 text-slate-400 border-slate-500/20",
};

const CATEGORY: Record<string, string> = {
  Technical: "bg-slate-500/20 text-slate-300 border-slate-400/20",
  "On-Page": "bg-violet-500/20 text-violet-300 border-violet-400/20",
  Content: "bg-blue-500/20 text-blue-300 border-blue-400/20",
  "AI-GEO": "bg-pink-500/20 text-pink-300 border-pink-400/20",
};

type BadgeVariant = "plan_status" | "job_status" | "confidence" | "approval" | "category";

interface StatusBadgeProps {
  value: string;
  variant: BadgeVariant;
  className?: string;
}

function getStyle(variant: BadgeVariant, value: string): string {
  const map: Record<BadgeVariant, Record<string, string>> = {
    plan_status: PLAN_STATUS,
    job_status: JOB_STATUS,
    confidence: CONFIDENCE,
    approval: APPROVAL,
    category: CATEGORY,
  };
  return (
    map[variant][value] ?? "bg-white/10 text-white/60 border-white/10"
  );
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ value, variant, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        getStyle(variant, value),
        className
      )}
    >
      {formatLabel(value)}
    </span>
  );
}
