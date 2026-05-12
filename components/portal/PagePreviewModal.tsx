"use client";

import { useEffect } from "react";
import type { PageCreationSuggestion } from "@/lib/supabase";

const PAGE_TYPE_ACCENT: Record<string, { bg: string; text: string; border: string }> = {
  "Location Page":   { bg: "bg-emerald-600", text: "text-white", border: "border-emerald-600" },
  "Service Page":    { bg: "bg-blue-600",    text: "text-white", border: "border-blue-600"    },
  "Industry Page":   { bg: "bg-violet-700",  text: "text-white", border: "border-violet-700"  },
  "Use-Case Page":   { bg: "bg-amber-600",   text: "text-white", border: "border-amber-600"   },
  "Job Title Page":  { bg: "bg-indigo-600",  text: "text-white", border: "border-indigo-600"  },
  "Comparison Page": { bg: "bg-rose-600",    text: "text-white", border: "border-rose-600"    },
};

function getAccent(type: string) {
  return PAGE_TYPE_ACCENT[type] ?? { bg: "bg-slate-800", text: "text-white", border: "border-slate-800" };
}

export function PagePreviewModal({
  suggestion,
  companyName,
  onClose,
}: {
  suggestion: PageCreationSuggestion;
  companyName: string;
  onClose: () => void;
}) {
  const accent = getAccent(suggestion.page_type);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal panel — slides in from right, full height */}
      <div className="relative ml-auto w-full max-w-3xl bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Modal chrome bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-100 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 bg-white rounded-md px-3 py-1 text-[12px] text-slate-500 font-mono border border-slate-200 truncate">
            {suggestion.suggested_slug}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-[13px] font-medium px-2 py-0.5 rounded hover:bg-slate-200 transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Scrollable page content */}
        <div className="flex-1 overflow-y-auto bg-white">

          {/* Faux site nav */}
          <div className="border-b border-slate-200 px-8 py-3 flex items-center justify-between">
            <span className="text-[15px] font-bold text-slate-900">{companyName}</span>
            <div className="flex items-center gap-5">
              {["Services", "About", "Contact"].map(l => (
                <span key={l} className="text-[13px] text-slate-500">{l}</span>
              ))}
            </div>
          </div>

          {/* Hero */}
          <div className={`${accent.bg} px-8 py-14`}>
            <div className="max-w-2xl">
              <div className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/20 ${accent.text} mb-4`}>
                {suggestion.page_type}
              </div>
              <h1 className={`text-[32px] font-bold leading-tight ${accent.text} mb-4`}>
                {suggestion.generated_h1 || suggestion.page_title}
              </h1>
              {suggestion.generated_meta_description && (
                <p className={`text-[16px] leading-relaxed ${accent.text} opacity-90`}>
                  {suggestion.generated_meta_description}
                </p>
              )}
              <button className="mt-6 px-5 py-2.5 rounded-lg bg-white text-[14px] font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
                Get in Touch
              </button>
            </div>
          </div>

          {/* SEO meta strip */}
          {(suggestion.generated_meta_title || suggestion.generated_meta_description) && (
            <div className="bg-slate-50 border-b border-slate-200 px-8 py-3 flex items-start gap-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Meta Title</p>
                <p className="text-[13px] text-slate-700 truncate">{suggestion.generated_meta_title}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Meta Description</p>
                <p className="text-[13px] text-slate-700 line-clamp-2">{suggestion.generated_meta_description}</p>
              </div>
              {suggestion.generated_word_count && (
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Words</p>
                  <p className="text-[13px] font-semibold text-slate-700">{suggestion.generated_word_count.toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {/* Body content */}
          {suggestion.generated_body ? (
            <div className="px-8 py-10 max-w-2xl mx-auto">
              <div
                className="
                  text-[16px] text-slate-700 leading-[1.8]
                  [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:leading-tight
                  [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-6 [&_h3]:mb-2
                  [&_p]:mb-5 [&_p]:leading-[1.8]
                  [&_ul]:pl-6 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-2
                  [&_ol]:pl-6 [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:space-y-2
                  [&_li]:text-[16px] [&_li]:leading-[1.7]
                  [&_strong]:font-semibold [&_strong]:text-slate-900
                "
                dangerouslySetInnerHTML={{ __html: suggestion.generated_body }}
              />
            </div>
          ) : (
            <div className="px-8 py-16 text-center text-slate-400">
              <p className="text-[14px]">Content not yet generated.</p>
            </div>
          )}

          {/* Faux footer */}
          <div className="border-t border-slate-200 px-8 py-6 bg-slate-50">
            <p className="text-[12px] text-slate-400">© {new Date().getFullYear()} {companyName} · All rights reserved</p>
          </div>
        </div>
      </div>
    </div>
  );
}
