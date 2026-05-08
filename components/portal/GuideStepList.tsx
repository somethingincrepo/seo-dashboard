"use client";

import { CopyButton } from "@/components/ui/CopyButton";
import type { GuideStep } from "@/lib/implementation-guides/types";

// Source bag of values the guide can pull copyables and {{placeholders}} from.
// For approval-flow changes this is essentially the Change.fields shape; for the
// full-article-publish surface we synthesize a similar bag with html_body / slug etc.
export type GuideValueBag = Partial<Record<string, string>>;

function substitute(text: string, values: GuideValueBag): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const v = values[key];
    return v == null || v === "" ? `{${key} not available}` : String(v);
  });
}

interface GuideStepListProps {
  steps: GuideStep[];
  values: GuideValueBag;
}

export function GuideStepList({ steps, values }: GuideStepListProps) {
  return (
    <ol className="space-y-4">
      {steps.map((step, idx) => {
        const copyValue = step.copyable ? values[step.copyable.valueKey] : undefined;
        return (
          <li key={idx} className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center mt-0.5">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 leading-relaxed">
                {substitute(step.text, values)}
              </p>
              {step.warning && (
                <div className="mt-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  ⚠ {step.warning}
                </div>
              )}
              {step.copyable && (
                <div className="mt-2">
                  {copyValue ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-200 bg-white">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                          {step.copyable.label}
                        </span>
                        <CopyButton value={copyValue} label="Copy" />
                      </div>
                      <pre className="px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap break-words font-mono max-h-72 overflow-auto">
                        {copyValue}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">
                      ({step.copyable.label} not available for this change)
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
