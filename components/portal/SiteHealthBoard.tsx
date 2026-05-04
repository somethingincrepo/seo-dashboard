import Link from "next/link";
import type { AuditRunSummary, AuditIssue } from "@/lib/audit/queries";
import { buildHealthChecks, type HealthCheck, type HealthStatus } from "@/lib/audit/health-checks";

interface Props {
  token: string;
  run: AuditRunSummary;
  issues: AuditIssue[];
}

export function SiteHealthBoard({ token, run, issues }: Props) {
  const checks = buildHealthChecks(run, issues);
  const totalCount = checks.length;
  const passCount = checks.filter((c) => c.status === "ok").length;
  const failCount = checks.filter((c) => c.status === "fail").length;

  // Group by section
  const groups = new Map<string, HealthCheck[]>();
  for (const c of checks) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group)!.push(c);
  }
  const groupOrder: HealthCheck["group"][] = [
    "Security",
    "Discoverability",
    "AI readiness",
    "Indexability",
    "Structure",
  ];

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <SummaryDial pass={passCount} total={totalCount} />
          <div>
            <div className="text-sm font-medium text-slate-700">
              {failCount === 0
                ? "All foundational signals look good."
                : `${failCount} foundational signal${failCount === 1 ? "" : "s"} need${failCount === 1 ? "s" : ""} attention.`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Crawl from {new Date(run.crawl_completed_at ?? run.created_at).toLocaleString()}.
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          <span className="font-medium text-slate-700 tabular-nums">{passCount}</span>
          <span className="text-slate-400"> / {totalCount} passing</span>
        </div>
      </div>

      {/* Grouped sections */}
      {groupOrder.map((group) => {
        const rows = groups.get(group);
        if (!rows || rows.length === 0) return null;
        return (
          <div key={group} className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex items-center gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">{group}</span>
              <span className="text-[11px] text-slate-400 tabular-nums">
                ({rows.filter((r) => r.status === "ok").length}/{rows.length})
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map((row) => (
                <CheckRow key={row.id} token={token} row={row} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CheckRow({ token, row }: { token: string; row: HealthCheck }) {
  const statusUI = STATUS_UI[row.status];
  const inner = (
    <div className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
      <div className="mt-0.5 shrink-0">{statusUI.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[14px] font-medium ${statusUI.labelClass}`}>{row.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ring-1 ring-inset ${statusUI.pillClass}`}>
            {statusUI.pillText}
          </span>
        </div>
        <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{row.why}</p>
        {row.detail && (
          <p className={`text-[12px] mt-1.5 ${row.status === "fail" ? "text-rose-600" : row.status === "warn" ? "text-amber-700" : "text-slate-500"}`}>
            {row.detail}
          </p>
        )}
      </div>
      {row.rule_id && (row.status === "fail" || row.status === "warn") && (
        <div className="text-[11px] text-indigo-600 hover:underline whitespace-nowrap shrink-0 self-center">
          View affected pages →
        </div>
      )}
    </div>
  );

  if (row.rule_id && (row.status === "fail" || row.status === "warn")) {
    return (
      <Link href={`/portal/${token}/audit?rule=${row.rule_id}`} className="block">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

const STATUS_UI: Record<HealthStatus, { icon: React.ReactNode; pillText: string; pillClass: string; labelClass: string }> = {
  ok: {
    icon: <Dot color="bg-emerald-500" ring="ring-emerald-200/70" check />,
    pillText: "Healthy",
    pillClass: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    labelClass: "text-slate-800",
  },
  fail: {
    icon: <Dot color="bg-rose-500" ring="ring-rose-200/70" cross />,
    pillText: "Needs fix",
    pillClass: "bg-rose-50 text-rose-700 ring-rose-200/70",
    labelClass: "text-slate-900",
  },
  warn: {
    icon: <Dot color="bg-amber-400" ring="ring-amber-200/70" exclaim />,
    pillText: "Warning",
    pillClass: "bg-amber-50 text-amber-700 ring-amber-200/70",
    labelClass: "text-slate-900",
  },
  unknown: {
    icon: <Dot color="bg-slate-300" ring="ring-slate-200" dash />,
    pillText: "Unknown",
    pillClass: "bg-slate-50 text-slate-500 ring-slate-200",
    labelClass: "text-slate-500",
  },
};

function Dot({ color, ring, check, cross, exclaim, dash }: { color: string; ring: string; check?: boolean; cross?: boolean; exclaim?: boolean; dash?: boolean }) {
  return (
    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center ring-2 ring-inset ${ring} bg-white`}>
      <span className={`w-3.5 h-3.5 rounded-full ${color} flex items-center justify-center`}>
        {check && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
        {cross && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        )}
        {exclaim && (
          <span className="text-white text-[10px] font-bold leading-none">!</span>
        )}
        {dash && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="12" x2="18" y2="12"/>
          </svg>
        )}
      </span>
    </span>
  );
}

function SummaryDial({ pass, total }: { pass: number; total: number }) {
  const pct = total > 0 ? pass / total : 0;
  const ring = `conic-gradient(rgb(16 185 129) ${(pct * 360).toFixed(0)}deg, rgb(226 232 240) 0deg)`;
  return (
    <div className="relative w-12 h-12 rounded-full" style={{ background: ring }}>
      <div className="absolute inset-1 rounded-full bg-white flex items-center justify-center">
        <span className="text-[14px] font-semibold text-slate-700 tabular-nums">{Math.round(pct * 100)}%</span>
      </div>
    </div>
  );
}
