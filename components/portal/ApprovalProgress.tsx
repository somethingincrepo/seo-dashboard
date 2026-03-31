interface ApprovalProgressProps {
  total: number;
}

export function ApprovalProgress({ total }: ApprovalProgressProps) {
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-white/40">
      <span className="text-amber-400 font-semibold text-base">{total}</span>
      <span>recommendation{total !== 1 ? "s" : ""} awaiting your decision</span>
      <span className="text-white/20">·</span>
      <span className="text-xs">Decisions save instantly</span>
    </div>
  );
}
