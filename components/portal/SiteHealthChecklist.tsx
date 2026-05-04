import type { AuditRunSummary } from "@/lib/audit/queries";

interface Props {
  run: AuditRunSummary;
}

interface CheckRow {
  label: string;
  ok: boolean | null;
  description: string;
  rule_id: string;
}

function buildRows(run: AuditRunSummary): CheckRow[] {
  return [
    {
      label: "HTTPS enforced",
      ok: run.https_enforced,
      description: "All HTTP requests 301-redirect to the HTTPS equivalent.",
      rule_id: "R013",
    },
    {
      label: "HSTS header present",
      ok: run.hsts_header_present,
      description: "Strict-Transport-Security tells browsers to only ever connect via HTTPS.",
      rule_id: "R014",
    },
    {
      label: "robots.txt published",
      ok: run.robots_txt_present,
      description: "Tells crawlers where the sitemap is and what to skip.",
      rule_id: "R009",
    },
    {
      label: "XML sitemap published",
      ok: run.sitemap_present,
      description: "Primary discovery signal for which URLs you want indexed.",
      rule_id: "R010",
    },
    {
      label: "llms.txt published",
      ok: run.llms_txt_present,
      description: "Lets AI assistants summarize your site accurately.",
      rule_id: "R063",
    },
    {
      label: "llms-full.txt published",
      ok: run.llms_full_txt_present,
      description: "Full-text companion to llms.txt — boosts AI answer quality.",
      rule_id: "R064",
    },
  ];
}

export function SiteHealthChecklist({ run }: Props) {
  const rows = buildRows(run);
  const passed = rows.filter((r) => r.ok === true).length;
  const total = rows.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/40">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">Site essentials</div>
          <div className="text-[12px] text-slate-500 mt-0.5">Foundational signals every site should have in place.</div>
        </div>
        <div className="text-sm font-medium text-slate-700 tabular-nums">
          <span className={passed === total ? "text-emerald-600" : "text-slate-700"}>{passed}</span>
          <span className="text-slate-400"> / {total}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
        {rows.map((row) => (
          <CheckCell key={row.rule_id} row={row} />
        ))}
      </div>
    </div>
  );
}

function CheckCell({ row }: { row: CheckRow }) {
  const isOk = row.ok === true;
  const isFail = row.ok === false;
  const isUnknown = row.ok === null;

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-white">
      <div className="mt-0.5 shrink-0">
        {isOk && <IconCheck />}
        {isFail && <IconX />}
        {isUnknown && <IconDash />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${isOk ? "text-slate-800" : isFail ? "text-rose-700" : "text-slate-500"}`}>
            {row.label}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{row.rule_id}</span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{row.description}</div>
      </div>
    </div>
  );
}

function IconCheck() {
  return (
    <span className="inline-flex w-5 h-5 rounded-full bg-emerald-50 items-center justify-center ring-1 ring-inset ring-emerald-200/70">
      <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </span>
  );
}

function IconX() {
  return (
    <span className="inline-flex w-5 h-5 rounded-full bg-rose-50 items-center justify-center ring-1 ring-inset ring-rose-200/70">
      <svg className="w-3 h-3 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </span>
  );
}

function IconDash() {
  return (
    <span className="inline-flex w-5 h-5 rounded-full bg-slate-100 items-center justify-center ring-1 ring-inset ring-slate-200">
      <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="12" x2="18" y2="12"/>
      </svg>
    </span>
  );
}
