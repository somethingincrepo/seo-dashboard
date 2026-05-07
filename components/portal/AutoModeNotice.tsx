"use client";

import { GuideStepList } from "./GuideStepList";
import type { GuideEntry } from "@/lib/implementation-guides/types";
import type { ChangeFields } from "@/lib/changes";

type Props = {
  entry: GuideEntry;
  fields?: ChangeFields;
};

function autoLines(entry: GuideEntry): string[] {
  const lines: string[] = [];
  switch (entry.deliverable) {
    case "title_tag":
      lines.push("Update the title tag via the WordPress REST API");
      lines.push("Verify the new value reads back correctly after write");
      lines.push("No plugin changes required");
      break;
    case "meta_description":
      lines.push("Update the meta description via the WordPress REST API");
      lines.push("Verify the new value reads back correctly after write");
      break;
    case "h1":
      lines.push("Update the post or page title via the WordPress REST API");
      lines.push("Verify the heading reads back after write");
      break;
    case "content_rewrite":
    case "content_block_insert":
    case "full_article_publish":
      lines.push("Write the full content body via the WordPress REST API");
      lines.push("Preserve existing title, slug, and meta fields");
      lines.push("Verify a before/after snapshot before finalizing");
      break;
    case "alt_text":
      lines.push("Update the image alt attribute via the WordPress Media API");
      lines.push("Verify the alt text reads back after write");
      break;
    case "redirect":
      lines.push("Add the 301 redirect rule via the WordPress REST API or Cloudflare");
      lines.push("Test that the old URL forwards to the destination");
      break;
    case "faq_schema":
    case "schema_org":
    case "location_signals":
      lines.push("Inject the JSON-LD script block into the page head");
      lines.push("Validate with Google Rich Results Test after publishing");
      break;
    default:
      lines.push("Apply the recommended change automatically");
      lines.push("Verify the result after implementation");
  }
  return lines;
}

export function AutoModeNotice({ entry, fields }: Props) {
  const lines = autoLines(entry);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3">
        <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-400 shrink-0 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-emerald-800 mb-1.5">
            We will handle this automatically
          </p>
          <ul className="space-y-1">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-emerald-700">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="group border-t border-emerald-200">
        <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none list-none bg-emerald-50 hover:bg-emerald-100 transition-colors">
          <span className="text-[12px] text-emerald-700 font-medium">
            Prefer to do it yourself? See manual steps
          </span>
          <svg
            className="w-3.5 h-3.5 text-emerald-500 transition-transform duration-200 group-open:rotate-180 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="px-4 py-4 border-t border-emerald-200 bg-white">
          {entry.prerequisites && entry.prerequisites.length > 0 && (
            <div className="mb-3 space-y-1">
              {entry.prerequisites.map((p, i) => (
                <div key={i} className="text-[12px] text-slate-500 flex gap-2">
                  <span className="shrink-0 text-slate-400">Before you start:</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          )}
          <GuideStepList steps={entry.steps} fields={fields} />
        </div>
      </details>
    </div>
  );
}
