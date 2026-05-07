"use client";

import { resolveGuide } from "@/lib/implementation-guides";
import type { DeliverableType } from "@/lib/implementation-guides/types";
import type { Client } from "@/lib/clients";
import type { Change } from "@/lib/changes";
import type { Capabilities, Platform } from "@/lib/connections/types";
import { platformFromCmsField } from "@/lib/connections/registry";
import { GuideStepList } from "./GuideStepList";
import { AutoModeNotice } from "./AutoModeNotice";

type Props = {
  deliverable: DeliverableType;
  client: Client;
  change?: Change;
  capabilities?: Capabilities | null;
  defaultOpen?: boolean;
};

const PLATFORM_LABELS: Record<Platform | "generic", string> = {
  wordpress_self: "WordPress",
  shopify: "Shopify",
  hubspot: "HubSpot",
  webflow: "Webflow",
  cloudflare: "Cloudflare",
  framer: "Framer",
  squarespace: "Squarespace",
  wix: "Wix",
  generic: "your site",
};

const DELIVERABLE_ACTIONS: Record<DeliverableType, string> = {
  title_tag: "update the title tag",
  meta_description: "update the meta description",
  h1: "update the H1 heading",
  internal_link_insertion: "insert the internal link",
  content_rewrite: "publish the content rewrite",
  content_block_insert: "insert the content block",
  full_article_publish: "publish this article",
  schema_org: "add schema markup",
  faq_schema: "add FAQ schema",
  location_signals: "add location signals",
  redirect: "set up the redirect",
  canonical: "set the canonical URL",
  alt_text: "update the alt text",
  robots_txt: "update robots.txt",
  sitemap_xml: "update the sitemap",
  indexation_submit: "submit for indexing",
};

function guideHeaderLabel(deliverable: DeliverableType, platform: Platform | "generic"): string {
  const platformLabel = PLATFORM_LABELS[platform] ?? "your site";
  const action = DELIVERABLE_ACTIONS[deliverable];
  if (platform === "generic") return `How to ${action}`;
  return `How to ${action} in ${platformLabel}`;
}

export function ImplementationGuide({
  deliverable,
  client,
  change,
  capabilities,
  defaultOpen = false,
}: Props) {
  const { entry, mode } = resolveGuide(deliverable, client, capabilities);

  const platform = platformFromCmsField(client.fields.cms) ?? "generic";
  const headerLabel = guideHeaderLabel(deliverable, platform as Platform | "generic");

  return (
    <details
      className="group border border-slate-150 rounded-lg overflow-hidden"
      open={defaultOpen || undefined}
    >
      <summary className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer select-none list-none hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-slate-700 truncate">
            {headerLabel}
          </span>
          {entry.estimatedMinutes > 0 && (
            <span className="text-[11px] text-slate-400 shrink-0">
              {entry.estimatedMinutes} min
            </span>
          )}
        </div>
        <svg
          className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-180 shrink-0 ml-2"
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

      <div className="px-4 py-4 border-t border-slate-100 bg-white space-y-4">
        {mode === "auto" ? (
          <AutoModeNotice entry={entry} fields={change?.fields} />
        ) : (
          <>
            {entry.prerequisites && entry.prerequisites.length > 0 && (
              <div className="space-y-1">
                {entry.prerequisites.map((p, i) => (
                  <div key={i} className="text-[12px] text-slate-500 flex gap-2">
                    <span className="shrink-0 font-medium text-slate-400">Before you start:</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}
            <GuideStepList steps={entry.steps} fields={change?.fields} />
          </>
        )}
      </div>
    </details>
  );
}
