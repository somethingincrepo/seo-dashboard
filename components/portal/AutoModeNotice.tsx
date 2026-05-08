"use client";

interface AutoModeNoticeProps {
  // Short summary of what we'll change. e.g. "We'll update the Pricing page title tag to '...'"
  summary?: string;
  // Free-form note. Optional.
  note?: string;
}

export function AutoModeNotice({ summary, note }: AutoModeNoticeProps) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
          ✓
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-emerald-900">
            We&apos;re handling this for you
          </div>
          {summary && (
            <p className="mt-1 text-sm text-emerald-800 leading-relaxed">{summary}</p>
          )}
          {note && (
            <p className="mt-2 text-xs text-emerald-700">{note}</p>
          )}
        </div>
      </div>
    </div>
  );
}
