import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";
import { GlassCard } from "@/components/ui/GlassCard";

export const revalidate = 0;

// ── Deliverable definitions ────────────────────────────────────────────────────

type DeliverableKey =
  | "articles_standard"
  | "articles_longform"
  | "content_refreshes"
  | "pages_optimized"
  | "internal_links"
  | "faq_sections"
  | "reddit_comments";

const DELIVERABLE_META: Record<
  DeliverableKey,
  {
    label: string;
    singularLabel: string;
    unit: string;
    description: string;
    color: string;
    bg: string;
    border: string;
    icon: string;
  }
> = {
  articles_standard: {
    label: "Standard Articles",
    singularLabel: "Standard Article",
    unit: "per month",
    description:
      "New blog posts written to target specific keywords in your strategy. Each is 1,500–2,500 words — researched, drafted, and staged in your CMS as a draft for your review before publishing.",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    icon: "✦",
  },
  articles_longform: {
    label: "Long-Form Guides",
    singularLabel: "Long-Form Guide",
    unit: "per month",
    description:
      "In-depth cornerstone content targeting competitive, high-value keywords. Each guide is 3,000–5,000 words and is built to rank for broad topic clusters, not just single keywords.",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
    icon: "◆",
  },
  content_refreshes: {
    label: "Content Refreshes",
    singularLabel: "Content Refresh",
    unit: "per month",
    description:
      "Existing pages on your site that have lost rankings or are underperforming are rewritten to improve keyword coverage and strengthen on-page signals. Updated drafts appear in your portal for approval before anything goes live.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    icon: "↺",
  },
  pages_optimized: {
    label: "Pages Optimized",
    singularLabel: "Page Optimized",
    unit: "per month",
    description:
      "Existing pages are improved through title tag updates, meta description rewrites, heading restructuring, and content edits — all surfaced in your Approvals queue with clear before-and-after previews.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    icon: "◈",
  },
  internal_links: {
    label: "Internal Links",
    singularLabel: "Internal Link",
    unit: "per month",
    description:
      "New internal links added between relevant pages on your site. Internal linking distributes authority from high-traffic pages to new content and helps search engines discover and rank deeper pages.",
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
    icon: "⟶",
  },
  faq_sections: {
    label: "FAQ Sections",
    singularLabel: "FAQ Section",
    unit: "per month",
    description:
      "Question-and-answer sections written for your key service or content pages. FAQs are marked up with schema so they can appear directly in Google search results and AI-generated answers.",
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-100",
    icon: "?",
  },
  reddit_comments: {
    label: "Reddit Engagements",
    singularLabel: "Reddit Engagement",
    unit: "per month",
    description:
      "Monitored threads on Reddit where your business, product, or topic comes up. Relevant conversations are surfaced in your portal so your team can respond directly — building brand visibility in places AI models frequently cite.",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-100",
    icon: "↗",
  },
};

const ALWAYS_INCLUDED = [
  {
    title: "Monthly site audit",
    desc: "Your entire site is crawled each month. Every page is scored across technical health, on-page SEO, content quality, and AI-visibility signals — then ranked by impact.",
  },
  {
    title: "Approval-gated implementation",
    desc: "Nothing changes on your site without your sign-off. Every proposed change goes through your Approvals queue first, with a before-and-after preview.",
  },
  {
    title: "Automated implementation",
    desc: "On WordPress, approved changes are applied to your live site automatically — no developer required. Other CMS platforms are handled by our team.",
  },
  {
    title: "Monthly performance report",
    desc: "A summary of what changed, how rankings shifted, and what's planned for next month — delivered automatically to your portal at month end.",
  },
  {
    title: "Keyword research",
    desc: "Ongoing keyword group maintenance. As gaps and opportunities are identified, your keyword groups are updated to keep content targeting current.",
  },
  {
    title: "AI-GEO optimization",
    desc: "Schema markup, entity signals, and FAQ content are added to make your site more visible in AI-generated answers from ChatGPT, Perplexity, and Google's AI Overviews.",
  },
];

const DELIVERABLE_ORDER: DeliverableKey[] = [
  "articles_standard",
  "articles_longform",
  "content_refreshes",
  "pages_optimized",
  "internal_links",
  "faq_sections",
  "reddit_comments",
];

function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${pluralForm ?? singular + "s"}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DeliverablesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const tier = ((client.fields.package as PackageTier) || "growth") as PackageTier;
  const pkg = PACKAGES[tier];
  const tierLabel = PACKAGE_LABELS[tier];
  const companyName = client.fields.company_name || "Your";

  const activeDeliverables = DELIVERABLE_ORDER.filter(
    (key) => pkg[key] > 0
  );

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          {tierLabel} Plan
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          What&rsquo;s included
        </h1>
        <p className="text-base text-slate-500 mt-1">
          A plain-English breakdown of everything {companyName} receives each month.
        </p>
      </div>

      {/* Monthly deliverables */}
      <section>
        <GlassCard>
          <div className="px-6 pt-5 pb-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Delivered every month
            </div>
            <p className="text-[13px] text-slate-500">
              These deliverables reset at the start of each billing month.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {activeDeliverables.map((key) => {
              const count = pkg[key];
              const meta = DELIVERABLE_META[key];
              return (
                <div key={key} className="px-6 py-5 flex gap-5 items-start">
                  {/* Count badge */}
                  <div
                    className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center border ${meta.bg} ${meta.border}`}
                  >
                    <span className={`text-2xl font-bold leading-none tabular-nums ${meta.color}`}>
                      {count}
                    </span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wide mt-0.5 ${meta.color} opacity-70`}>
                      /mo
                    </span>
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-slate-900 mb-1">
                      {plural(count, meta.singularLabel, meta.label)}
                    </div>
                    <p className="text-[13px] text-slate-500 leading-relaxed">
                      {meta.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </section>

      {/* Always included */}
      <section>
        <GlassCard>
          <div className="px-6 pt-5 pb-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Always included
            </div>
            <p className="text-[13px] text-slate-500">
              These run continuously — no monthly cap.
            </p>
          </div>

          <div className="border-t border-slate-100 divide-y divide-slate-100">
            {ALWAYS_INCLUDED.map(({ title, desc }) => (
              <div key={title} className="px-6 py-4 flex gap-4 items-start">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <div>
                  <div className="text-[13px] font-semibold text-slate-800 mb-0.5">{title}</div>
                  <p className="text-[13px] text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* Footer note */}
      <p className="text-[12px] text-slate-400 pb-4">
        Questions about your plan or deliverables?{" "}
        <a
          href="https://calendly.com/somethinginc/something-inc-touchbase-1"
          target="_blank"
          rel="noreferrer"
          className="text-slate-600 underline hover:text-slate-900 transition-colors"
        >
          Book a call with our team.
        </a>
      </p>
    </div>
  );
}
