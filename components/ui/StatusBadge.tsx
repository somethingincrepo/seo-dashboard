import { cn } from "@/lib/utils";

const PLAN_STATUS: Record<string, string> = {
  form_submitted:       "text-slate-700 bg-slate-50 ring-slate-200",
  onboarding_setup:     "text-blue-700 bg-blue-50 ring-blue-100",
  month1_audit:         "text-indigo-700 bg-indigo-50 ring-indigo-100",
  awaiting_approval:    "text-amber-700 bg-amber-50 ring-amber-100",
  month1_implementing:  "text-indigo-700 bg-indigo-50 ring-indigo-100",
  active:               "text-emerald-700 bg-emerald-50 ring-emerald-100",
  paused:               "text-slate-600 bg-slate-50 ring-slate-200",
  failed:               "text-red-700 bg-red-50 ring-red-100",
};

const JOB_STATUS: Record<string, string> = {
  queued:           "text-slate-700 bg-slate-50 ring-slate-200",
  running:          "text-blue-700 bg-blue-50 ring-blue-100 animate-pulse",
  implementing:     "text-indigo-700 bg-indigo-50 ring-indigo-100 animate-pulse",
  awaiting_approval:"text-amber-700 bg-amber-50 ring-amber-100",
  complete:         "text-emerald-700 bg-emerald-50 ring-emerald-100",
  failed:           "text-red-700 bg-red-50 ring-red-100",
  Proposed:         "text-blue-700 bg-blue-50 ring-blue-100",
  Approved:         "text-emerald-700 bg-emerald-50 ring-emerald-100",
  Generating:       "text-amber-700 bg-amber-50 ring-amber-100",
  Ready:            "text-indigo-700 bg-indigo-50 ring-indigo-100",
  Published:        "text-teal-700 bg-teal-50 ring-teal-100",
  Skipped:          "text-slate-600 bg-slate-50 ring-slate-200",
  Completed:        "text-emerald-700 bg-emerald-50 ring-emerald-100",
};

const CONFIDENCE: Record<string, string> = {
  High:   "text-emerald-700 bg-emerald-50 ring-emerald-100",
  Medium: "text-amber-700 bg-amber-50 ring-amber-100",
  Low:    "text-red-700 bg-red-50 ring-red-100",
};

const APPROVAL: Record<string, string> = {
  pending:  "text-amber-700 bg-amber-50 ring-amber-100",
  approved: "text-emerald-700 bg-emerald-50 ring-emerald-100",
  skipped:  "text-slate-600 bg-slate-50 ring-slate-200",
  question: "text-blue-700 bg-blue-50 ring-blue-100",
  backlog:  "text-slate-600 bg-slate-50 ring-slate-200",
};

const CATEGORY: Record<string, string> = {
  Technical: "text-slate-700 bg-slate-50 ring-slate-200",
  "On-Page": "text-blue-700 bg-blue-50 ring-blue-100",
  Content:   "text-blue-700 bg-blue-50 ring-blue-100",
  "AI-GEO":  "text-pink-700 bg-pink-50 ring-pink-100",
};

const PRIORITY: Record<string, string> = {
  High:   "text-red-700 bg-red-50 ring-red-100",
  Medium: "text-amber-700 bg-amber-50 ring-amber-100",
  Low:    "text-slate-600 bg-slate-50 ring-slate-200",
};

type BadgeVariant = "plan_status" | "job_status" | "confidence" | "approval" | "category" | "priority";

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
    priority: PRIORITY,
  };
  return map[variant][value] ?? "text-slate-700 bg-slate-50 ring-slate-200";
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ value, variant, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset",
        getStyle(variant, value),
        className
      )}
    >
      {formatLabel(value)}
    </span>
  );
}
