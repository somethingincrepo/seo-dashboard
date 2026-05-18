import { getWeeklyTargets, type PackageTier } from "@/lib/packages";

interface Props {
 packageTier: PackageTier;
 /** Optional delivered counts for this week, keyed by deliverable. Renders progress vs target. */
 delivered?: Partial<{
 articles: number;
 faq_sections: number;
 content_refreshes: number;
 internal_links: number;
 reddit_comments: number;
 }>;
}

export function WeeklyTargetsCard({ packageTier, delivered = {} }: Props) {
 const targets = getWeeklyTargets(packageTier);

 const rows: Array<{ key: string; label: string; target: number; delivered: number; icon: React.ReactNode; tone: string }> = [
 {
 key: "articles",
 label: "Articles",
 target: targets.articles,
 delivered: delivered.articles ?? 0,
 icon: <Icon path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8" />,
 tone: "indigo",
 },
 {
 key: "faq_sections",
 label: "FAQ sections",
 target: targets.faq_sections,
 delivered: delivered.faq_sections ?? 0,
 icon: <Icon path="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
 tone: "violet",
 },
 {
 key: "content_refreshes",
 label: "Content refreshes",
 target: targets.content_refreshes,
 delivered: delivered.content_refreshes ?? 0,
 icon: <Icon path="M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />,
 tone: "sky",
 },
 {
 key: "internal_links",
 label: "Internal links",
 target: targets.internal_links,
 delivered: delivered.internal_links ?? 0,
 icon: <Icon path="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
 tone: "amber",
 },
 {
 key: "reddit_comments",
 label: "Reddit mentions",
 target: targets.reddit_comments,
 delivered: delivered.reddit_comments ?? 0,
 icon: <Icon path="M12 14a4 4 0 1 0-4-4 M12 14a4 4 0 1 1 4-4 M9 17h6 M12 8V5" />,
 tone: "rose",
 },
 ].filter((r) => r.target > 0);

 if (rows.length === 0) return null;

 const totalTarget = rows.reduce((s, r) => s + r.target, 0);
 const totalDelivered = rows.reduce((s, r) => s + Math.min(r.delivered, r.target), 0);

 return (
 <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
 <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex-wrap">
 <div className="flex items-center gap-3">
 <span className="text-[12px] font-semibold tracking-widest text-slate-500">This week</span>
 <span className="text-[11px] text-slate-400">
 Week {targets.week_of_month} of 4 · starting {fmtDate(targets.week_start)}
 </span>
 </div>
 <div className="flex items-center gap-2 text-[12px]">
 <span className="text-slate-700 font-medium tabular-nums">{totalDelivered}</span>
 <span className="text-slate-400">/ {totalTarget} delivered</span>
 </div>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-100">
 {rows.map((row) => {
 const { key, ...rest } = row;
 return <DeliverableTile key={key} {...rest} />;
 })}
 </div>
 </div>
 );
}

function DeliverableTile({
 label,
 target,
 delivered,
 icon,
 tone,
}: {
 label: string;
 target: number;
 delivered: number;
 icon: React.ReactNode;
 tone: string;
}) {
 const capped = Math.min(delivered, target);
 const pct = target > 0 ? Math.round((capped / target) * 100) : 0;
 const complete = capped >= target;
 const iconBg =
 tone === "indigo" ? "bg-indigo-50 text-indigo-600"
 : tone === "violet" ? "bg-violet-50 text-violet-600"
 : tone === "sky" ? "bg-indigo-50 text-indigo-600"
 : tone === "emerald" ? "bg-emerald-50 text-emerald-600"
 : tone === "amber" ? "bg-amber-50 text-amber-600"
 : "bg-rose-50 text-rose-600";
 const barColor =
 complete ? "bg-emerald-500"
 : tone === "indigo" ? "bg-indigo-500"
 : tone === "violet" ? "bg-violet-500"
 : tone === "sky" ? "bg-indigo-500"
 : tone === "emerald" ? "bg-emerald-500"
 : tone === "amber" ? "bg-amber-500"
 : "bg-rose-500";

 return (
 <div className="flex flex-col gap-2 px-4 py-3 bg-white">
 <div className="flex items-center gap-2">
 <span className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md ${iconBg}`}>
 {icon}
 </span>
 <span className="text-[12px] text-slate-600 truncate flex-1">{label}</span>
 </div>
 <div className="flex items-baseline gap-1.5">
 <span className="text-[18px] font-semibold tabular-nums text-slate-900 leading-none">{capped}</span>
 <span className="text-[11px] text-slate-400 tabular-nums">/ {target}</span>
 {complete && (
 <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70 font-medium">
 Done
 </span>
 )}
 </div>
 <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
 <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
 </div>
 </div>
 );
}

function Icon({ path }: { path: string }) {
 return (
 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
 <path d={path} />
 </svg>
 );
}

function fmtDate(iso: string): string {
 const d = new Date(iso + "T00:00:00Z");
 return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}
