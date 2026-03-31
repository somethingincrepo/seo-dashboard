import { GlassCard } from "@/components/ui/GlassCard";
import type { Client } from "@/lib/clients";

interface TimelineStep {
  label: string;
  description: string;
  status: "complete" | "current" | "future";
  date: string;
}

function getTimelineSteps(
  client: Client,
  pendingCount: number,
  approvedCount: number,
  implementedCount: number
): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const status = client.fields.status || client.fields.plan_status || "form_submitted";
  const totalChanges = pendingCount + approvedCount + implementedCount;

  // Step 1: Audit
  const auditComplete = ["awaiting_approval", "month1_implementing", "active"].includes(status);
  steps.push({
    label: "Site audit complete",
    description: "We analyzed your site structure, content, and technical SEO.",
    status: auditComplete ? "complete" : status === "month1_audit" ? "current" : "future",
    date: auditComplete ? "Complete" : status === "month1_audit" ? "In progress" : "Upcoming",
  });

  // Step 2: Recommendations identified
  const hasChanges = totalChanges > 0;
  steps.push({
    label: hasChanges ? `${totalChanges} recommendations identified` : "Identify recommendations",
    description: hasChanges ? "Found opportunities to improve your search visibility." : "We'll identify the highest-impact optimizations.",
    status: hasChanges ? "complete" : "future",
    date: hasChanges ? "Complete" : "After audit",
  });

  // Step 3: Review
  steps.push({
    label: pendingCount > 0 ? "Awaiting your review" : approvedCount > 0 ? "Review complete" : "Review recommendations",
    description: pendingCount > 0 ? "Review and approve so we can begin." : "You've reviewed the recommendations.",
    status: pendingCount > 0 ? "current" : approvedCount > 0 ? "complete" : "future",
    date: pendingCount > 0 ? "Now" : approvedCount > 0 ? "Complete" : "After identification",
  });

  // Step 4: Implementation
  steps.push({
    label: implementedCount > 0 ? `${implementedCount} changes implemented` : "Implementation",
    description: implementedCount > 0 ? "Changes are live on your site." : "We'll implement approved changes within 48 hours.",
    status: implementedCount > 0 ? "complete" : status === "month1_implementing" ? "current" : "future",
    date: implementedCount > 0 ? "Complete" : "After approval",
  });

  // Step 5: Report
  steps.push({
    label: "Monthly report",
    description: "Performance data, changes made, and next month's plan.",
    status: status === "active" ? "complete" : "future",
    date: status === "active" ? "Available" : "~30 days",
  });

  return steps;
}

interface DashboardTimelineProps {
  client: Client;
  pendingCount: number;
  approvedCount: number;
  implementedCount: number;
}

export function DashboardTimeline({ client, pendingCount, approvedCount, implementedCount }: DashboardTimelineProps) {
  const steps = getTimelineSteps(client, pendingCount, approvedCount, implementedCount);

  return (
    <GlassCard className="p-6">
      <div className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-5">
        What we're working on
      </div>
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            {/* Icon column */}
            <div className="w-6 flex-shrink-0 flex flex-col items-center pt-0.5">
              {step.status === "complete" && (
                <span className="text-emerald-400 text-sm font-bold">✓</span>
              )}
              {step.status === "current" && (
                <span className="text-violet-400 text-sm animate-pulse">◉</span>
              )}
              {step.status === "future" && (
                <span className="text-white/20 text-sm">○</span>
              )}
              {i < steps.length - 1 && (
                <div className="w-px flex-1 mt-1 mb-1 border-l border-white/[0.06]" />
              )}
            </div>

            {/* Text column */}
            <div className="flex-1 min-w-0 py-1.5">
              <div className={`text-sm ${
                step.status === "current" ? "font-semibold text-white/90" :
                step.status === "complete" ? "text-white/70" :
                "text-white/20"
              }`}>
                {step.label}
              </div>
              <div className="text-xs text-white/30 mt-0.5">
                {step.description}
              </div>
            </div>

            {/* Date column */}
            <div className="text-xs text-white/20 text-right flex-shrink-0 w-28 pt-1">
              {step.date}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
