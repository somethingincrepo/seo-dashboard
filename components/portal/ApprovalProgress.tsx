interface ApprovalProgressProps {
  total: number;
}

export function ApprovalProgress({ total }: ApprovalProgressProps) {
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <span className="text-amber-600 font-semibold text-base tabular">{total}</span>
      <span>recommendation{total !== 1 ? "s" : ""} awaiting your decision</span>
    </div>
  );
}
