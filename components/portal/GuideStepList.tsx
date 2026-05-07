"use client";

import { CopyButton } from "@/components/ui/CopyButton";
import type { GuideStep } from "@/lib/implementation-guides/types";
import type { ChangeFields } from "@/lib/changes";

type Props = {
  steps: GuideStep[];
  fields?: ChangeFields;
};

function substitute(text: string, fields?: ChangeFields): string {
  if (!fields) return text;
  return text
    .replace(/{{proposed_value}}/g, fields.proposed_value ?? "")
    .replace(/{{page_url}}/g, fields.page_url ?? "")
    .replace(/{{current_value}}/g, fields.current_value ?? "");
}

export function GuideStepList({ steps, fields }: Props) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => {
        const text = substitute(step.text, fields);
        const copyValue = step.copyable && fields
          ? String(fields[step.copyable.valueKey] ?? "")
          : undefined;

        return (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-[13px] text-slate-600 leading-relaxed">{text}</p>

              {step.copyable && copyValue && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-150 px-3 py-2">
                  <span className="text-[11px] font-medium text-slate-400 shrink-0">
                    {step.copyable.label}
                  </span>
                  <span className="flex-1 text-[12px] text-slate-700 font-mono truncate">
                    {copyValue}
                  </span>
                  <CopyButton value={copyValue} label="Copy" />
                </div>
              )}

              {step.warning && (
                <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                  <span className="text-amber-500 text-[12px] shrink-0 mt-px">!</span>
                  <p className="text-[12px] text-amber-700 leading-relaxed">{step.warning}</p>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
