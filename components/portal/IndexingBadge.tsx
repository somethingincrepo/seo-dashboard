type IndexingStatus = "not_submitted" | "submitted" | "failed" | undefined | null;

interface IndexingBadgeProps {
  status: IndexingStatus;
  submittedAt?: string | null;
}

export function IndexingBadge({ status, submittedAt }: IndexingBadgeProps) {
  if (!status || status === "not_submitted") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200">
        Not indexed
      </span>
    );
  }

  if (status === "submitted") {
    const date = submittedAt
      ? new Date(submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200">
        <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
        Submitted{date ? ` ${date}` : ""}
      </span>
    );
  }

  // failed
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-200">
      Index failed
    </span>
  );
}
