import { cn } from "@/lib/utils";

const PLAN_STATUS: Record<string, string> = {
  form_submitted: "bg-slate-100 text-slate-600 border-slate-200",
  onboarding_setup: "bg-blue-50 text-blue-700 border-blue-200",
  month1_audit: "bg-indigo-50 text-indigo-700 border-indigo-200",
  awaiting_approval: "bg-amber-50 text-amber-700 border-amber-200",
  month1_implementing: "bg-indigo-50 text-indigo-700 border-indigo-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paused: "bg-slate-100 text-slate-500 border-slate-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const JOB_STATUS: Record<string, string> = {
  queued: "bg-slate-100 text-slate-600 border-slate-200",
  running: "bg-blue-50 text-blue-700 border-blue-200 animate-pulse",
  implementing: "bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse",
  awaiting_approval: "bg-amber-50 text-amber-700 border-amber-200",
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const CONFIDENCE: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-red-50 text-red-700 border-red-200",
};

const APPROVAL: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  skipped: "bg-slate-100 text-slate-600 border-slate-200",
  question: "bg-blue-50 text-blue-700 border-blue-200",
  backlog: "bg-slate-100 text-slate-500 border-slate-200",
};

const CATEGORY: Record<string, string> = {
  Technical: "bg-slate-100 text-slate-600 border-slate-200",
  "On-Page": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Content: "bg-blue-50 text-blue-700 border-blue-200",
  "AI-GEO": "bg-pink-50 text-pink-700 border-pink-200",
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
    map[variant][value] ?? "bg-slate-100 text-slate-600 border-slate-200"
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
