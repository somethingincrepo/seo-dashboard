"use client";

import { useState, useEffect, useCallback } from "react";

type ScheduledArticle = {
  id: string;
  title: string;
  scheduled_publish_date: string; // YYYY-MM-DD
  portal_approval: string | null;
};

interface PublishCalendarProps {
  token: string;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekday(date: Date): boolean {
  const d = date.getUTCDay();
  return d !== 0 && d !== 6;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PublishCalendar({ token }: PublishCalendarProps) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth()); // 0-indexed
  const [articles, setArticles] = useState<ScheduledArticle[]>([]);
  const [occupiedDates, setOccupiedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState<string | null>(null); // result_id being rescheduled
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/content-schedule?token=${token}`);
      if (!res.ok) return;
      const data = await res.json() as {
        articles: ScheduledArticle[];
        occupied_dates: string[];
      };
      setArticles(data.articles ?? []);
      setOccupiedDates(new Set(data.occupied_dates ?? []));
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // Build calendar grid for current month
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const startOffset = firstDay.getUTCDay(); // 0=Sun

  // Pad to start of week
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getUTCDate(); d++) {
    cells.push(new Date(Date.UTC(year, month, d)));
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const articlesByDate = new Map<string, ScheduledArticle[]>();
  for (const a of articles) {
    const existing = articlesByDate.get(a.scheduled_publish_date) ?? [];
    existing.push(a);
    articlesByDate.set(a.scheduled_publish_date, existing);
  }

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const handleCellClick = async (date: Date | null) => {
    if (!date || !rescheduling) return;
    const dateStr = toDateStr(date);

    if (!isWeekday(date)) {
      setFeedback({ type: "error", msg: "Weekends aren't available — pick a Mon–Fri." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const tomorrow = addDays(today, 1);
    if (date < tomorrow) {
      setFeedback({ type: "error", msg: "Can't schedule in the past." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    // Check if occupied by a different article
    const existingOnDay = articlesByDate.get(dateStr) ?? [];
    if (existingOnDay.length > 0 && !existingOnDay.some(a => a.id === rescheduling)) {
      setFeedback({ type: "error", msg: "That date is already taken. Pick another." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const res = await fetch(`/api/portal/content-schedule?token=${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result_id: rescheduling, new_date: dateStr }),
    });

    if (res.ok) {
      setRescheduling(null);
      setFeedback({ type: "success", msg: `Rescheduled to ${dateStr}.` });
      setTimeout(() => setFeedback(null), 2500);
      await load();
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string };
      setFeedback({ type: "error", msg: err.error ?? "Failed to reschedule." });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const todayStr = toDateStr(today);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800">Publishing Calendar</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">One article per weekday, shared across all clients</p>
        </div>
        <div className="flex items-center gap-3">
          {rescheduling && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-[12px] text-indigo-700 font-medium">
              <span>Click a date to reschedule</span>
              <button
                onClick={() => setRescheduling(null)}
                className="text-indigo-400 hover:text-indigo-600 ml-1"
              >✕</button>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors text-sm"
            >‹</button>
            <span className="text-[13px] font-semibold text-slate-700 min-w-[120px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors text-sm"
            >›</button>
          </div>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`mx-5 mt-3 px-4 py-2 rounded-lg text-[12px] font-medium ${feedback.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {feedback.msg}
        </div>
      )}

      {loading ? (
        <div className="px-5 py-10 text-center text-slate-400 text-sm">Loading…</div>
      ) : (
        <div className="p-4">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden">
            {cells.map((date, i) => {
              if (!date) {
                return <div key={`pad-${i}`} className="bg-white min-h-[80px]" />;
              }

              const dateStr = toDateStr(date);
              const isToday = dateStr === todayStr;
              const isPast = date < today;
              const weekend = !isWeekday(date);
              const dayArticles = articlesByDate.get(dateStr) ?? [];
              const isOccupiedByOther = occupiedDates.has(dateStr) && dayArticles.length === 0;
              const isReschedulingTarget = !!rescheduling && !isPast && !weekend;
              const tomorrow = addDays(today, 1);
              const canDrop = isReschedulingTarget && date >= tomorrow && !isOccupiedByOther;

              return (
                <div
                  key={dateStr}
                  onClick={() => canDrop && void handleCellClick(date)}
                  className={[
                    "bg-white min-h-[80px] p-2 flex flex-col gap-1 transition-colors",
                    isToday ? "ring-2 ring-inset ring-slate-900" : "",
                    weekend ? "opacity-40" : "",
                    isPast && !weekend ? "opacity-60" : "",
                    canDrop ? "cursor-pointer hover:bg-indigo-50 hover:ring-2 hover:ring-inset hover:ring-indigo-300" : "",
                    isOccupiedByOther && !isPast ? "bg-slate-50" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <span className={`text-[11px] font-semibold ${isToday ? "text-slate-900" : isPast ? "text-slate-300" : "text-slate-400"}`}>
                    {date.getUTCDate()}
                  </span>

                  {/* This client's articles */}
                  {dayArticles.map((a) => {
                    const isPublished = a.portal_approval === "published";
                    const isBeingRescheduled = a.id === rescheduling;
                    return (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); if (!isPublished) setRescheduling(isBeingRescheduled ? null : a.id); }}
                        className={[
                          "text-[10px] leading-tight px-1.5 py-1 rounded-md cursor-pointer truncate transition-all",
                          isPublished
                            ? "bg-green-100 text-green-700 cursor-default"
                            : isBeingRescheduled
                            ? "bg-indigo-200 text-indigo-800 ring-2 ring-indigo-400"
                            : "bg-slate-900 text-white hover:bg-slate-700",
                        ].join(" ")}
                        title={a.title}
                      >
                        {isPublished ? "✓ " : ""}{a.title}
                      </div>
                    );
                  })}

                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 px-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="inline-block w-3 h-3 rounded-sm bg-slate-900" />
              Scheduled
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-100" />
              Published
            </div>
            <div className="ml-auto text-[11px] text-slate-400">
              Click an article to reschedule · click a new date to confirm
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
