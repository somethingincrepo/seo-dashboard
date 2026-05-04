"use client";

interface Slice {
  key: string;
  label: string;
  value: number;
  /** Tailwind text color used when label is rendered (e.g. "text-rose-600") */
  textColor: string;
  /** SVG hex stroke color (e.g. "#f43f5e") */
  strokeColor: string;
}

interface Props {
  slices: Slice[];
  size?: number;
  thickness?: number;
  /** Optional click handler — passes the slice key */
  onSliceClick?: (key: string) => void;
  /** Highlighted slice key (rendered slightly brighter) */
  activeKey?: string | null;
  /** Big number rendered in the center; defaults to total */
  centerValue?: number | string;
  /** Small label under the big number */
  centerLabel?: string;
}

/**
 * Compact SVG donut chart. Each slice is a stroked circle segment using
 * stroke-dasharray + stroke-dashoffset (no chart library dep).
 */
export function AuditDonut({
  slices,
  size = 156,
  thickness = 14,
  onSliceClick,
  activeKey,
  centerValue,
  centerLabel,
}: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const radius = size / 2 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Empty state
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgb(241 245 249)" strokeWidth={thickness} />
        </svg>
      </div>
    );
  }

  let offset = 0;
  const segments = slices.map((s) => {
    const portion = s.value / total;
    const length = portion * circumference;
    const seg = { ...s, length, offset, portion };
    offset += length;
    return seg;
  });

  const headlineValue = centerValue ?? total;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgb(241 245 249)" strokeWidth={thickness} />
        {segments.map((s) => {
          const dim = activeKey && activeKey !== "all" && activeKey !== s.key ? 0.25 : 1;
          return (
            <circle
              key={s.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.strokeColor}
              strokeWidth={thickness}
              strokeLinecap="butt"
              strokeDasharray={`${s.length} ${circumference - s.length}`}
              strokeDashoffset={-s.offset}
              style={{ transition: "opacity 150ms", cursor: onSliceClick ? "pointer" : "default", opacity: dim }}
              onClick={() => onSliceClick?.(s.key)}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-semibold text-slate-900 tabular-nums leading-none">{headlineValue}</span>
        {centerLabel && <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">{centerLabel}</span>}
      </div>
    </div>
  );
}
