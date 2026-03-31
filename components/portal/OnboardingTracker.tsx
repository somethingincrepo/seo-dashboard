import { cn } from "@/lib/utils";

const STEPS = [
  { key: "form_submitted", label: "Form Received", desc: "We have your details and are getting started." },
  { key: "onboarding_setup", label: "Setup", desc: "Connecting your site and tools." },
  { key: "month1_audit", label: "Initial Audit", desc: "Running a full technical and content audit across your site." },
  { key: "awaiting_approval", label: "Your Review", desc: "Audit complete — your recommendations are ready to review." },
  { key: "month1_implementing", label: "Implementing", desc: "Approved changes are being applied to your site." },
  { key: "active", label: "Active", desc: "Monthly optimization is underway." },
];

const STATUS_INDEX: Record<string, number> = {
  form_submitted: 0,
  onboarding_setup: 1,
  month1_audit: 2,
  awaiting_approval: 3,
  month1_implementing: 4,
  active: 5,
};

interface OnboardingTrackerProps {
  planStatus: string;
}

export function OnboardingTracker({ planStatus }: OnboardingTrackerProps) {
  const currentIdx = STATUS_INDEX[planStatus] ?? 0;
  const currentStep = STEPS[currentIdx];

  return (
    <div className="space-y-6">
      {/* Step labels — horizontal */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-3.5 left-0 right-0 h-px bg-white/10 mx-8" />
        <div
          className="absolute top-3.5 left-0 h-px bg-gradient-to-r from-violet-500 to-teal-500 mx-8 transition-all"
          style={{ width: `${Math.round((currentIdx / (STEPS.length - 1)) * 100)}%` }}
        />
        <div className="relative flex justify-between">
          {STEPS.map((step, i) => {
            const done = i < currentIdx;
            const current = i === currentIdx;
            return (
              <div key={step.key} className="flex flex-col items-center gap-2" style={{ width: `${100 / STEPS.length}%` }}>
                <div className={cn(
                  "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all",
                  done ? "bg-emerald-500/30 border-emerald-400/50 text-emerald-300" :
                  current ? "bg-violet-500/30 border-violet-400/60 text-violet-300 ring-2 ring-violet-400/20" :
                  "bg-white/5 border-white/15 text-white/30"
                )}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={cn(
                  "text-[10px] text-center leading-tight",
                  current ? "text-white/80 font-medium" : done ? "text-white/50" : "text-white/25"
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current step description */}
      <div className="glass rounded-2xl p-5 border-l-2 border-violet-500/50">
        <div className="text-xs text-violet-400/80 uppercase tracking-wider mb-1">Current step</div>
        <div className="font-semibold text-white/90 mb-1">{currentStep.label}</div>
        <div className="text-sm text-white/50">{currentStep.desc}</div>
      </div>
    </div>
  );
}

