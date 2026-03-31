import { GlassCard } from "./GlassCard";

interface MetricTileProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: "violet" | "amber" | "emerald" | "blue";
}

const accentMap = {
  violet: "text-violet-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
  blue: "text-blue-400",
};

export function MetricTile({ label, value, sub, accent = "violet" }: MetricTileProps) {
  return (
    <GlassCard className="p-5">
      <div className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold ${accentMap[accent]}`}>{value}</div>
      {sub && <div className="text-white/30 text-xs mt-1">{sub}</div>}
    </GlassCard>
  );
}
