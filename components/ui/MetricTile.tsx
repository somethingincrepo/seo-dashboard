import { GlassCard } from "./GlassCard";

interface MetricTileProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: "violet" | "amber" | "emerald" | "blue";
}

const accentMap = {
  violet: "text-indigo-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
  blue: "text-blue-600",
};

export function MetricTile({ label, value, sub, accent = "violet" }: MetricTileProps) {
  return (
    <GlassCard className="p-5">
      <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold tabular ${accentMap[accent]}`}>{value}</div>
      {sub && <div className="text-slate-400 text-xs mt-1">{sub}</div>}
    </GlassCard>
  );
}
