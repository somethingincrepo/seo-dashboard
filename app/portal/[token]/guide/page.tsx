import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { GlassCard } from "@/components/ui/GlassCard";

export const revalidate = 0;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-100" />;
}

function Chevron() {
  return (
    <svg
      className="w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-180 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GuidePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Guide</h1>
        <p className="text-base text-slate-500 mt-1">A complete reference for your SEO portal</p>
      </div>

      {/* Quick Reference */}
      <GlassCard>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <div className="p-5">
            <SectionLabel>Your weekly job</SectionLabel>
            <ul className="space-y-2">
              {[
                "Review pending changes in Approvals",
                "Approve, skip, or ask questions",
                "Check title proposals each month",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5">
            <SectionLabel>Handled automatically</SectionLabel>
            <ul className="space-y-2">
              {[
                "Monthly site audit",
                "Implementing approved changes",
                "Blog title proposals",
                "Performance reports",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5">
            <SectionLabel>Status meanings</SectionLabel>
            <div className="space-y-1.5">
              {[
                ["Pending", "amber"],
                ["Approved", "emerald"],
                ["In Progress", "indigo"],
                ["Complete", "slate"],
                ["Manual Required", "amber"],
              ].map(([label, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    color === "amber" ? "bg-amber-400" :
                    color === "emerald" ? "bg-emerald-400" :
                    color === "indigo" ? "bg-indigo-400" :
                    "bg-slate-300"
                  }`} />
                  <span className="text-[12px] text-slate-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* How It Works */}
      <GlassCard>
        <div className="p-5">
          <SectionLabel>How it works</SectionLabel>
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                step: "01",
                title: "Audit",
                body: "Your site is scanned monthly. Our system identifies SEO improvements across technical, on-page, content, and AI visibility dimensions.",
                color: "text-indigo-500",
                bg: "bg-indigo-50",
              },
              {
                step: "02",
                title: "You Approve",
                body: "Each proposed change appears in your portal. You review the before and after, then approve, skip, or ask a question.",
                color: "text-amber-600",
                bg: "bg-amber-50",
              },
              {
                step: "03",
                title: "We Implement",
                body: "Approved changes are applied directly to your site. On WordPress, this happens automatically. Other platforms are handled by our team.",
                color: "text-emerald-600",
                bg: "bg-emerald-50",
              },
            ].map((item) => (
              <div key={item.step} className={`rounded-lg p-4 ${item.bg}`}>
                <div className={`text-[11px] font-bold tracking-widest mb-2 ${item.color}`}>
                  {item.step}
                </div>
                <div className="text-sm font-semibold text-slate-900 mb-1.5">{item.title}</div>
                <p className="text-[13px] text-slate-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Pipeline Board */}
      <GlassCard>
        <div className="p-5">
          <SectionLabel>Dashboard — pipeline board</SectionLabel>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            The main dashboard shows a Kanban board with all proposed changes for your site. Each card
            represents one SEO change. Click any card to see the full before-and-after detail and take action.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "To Review",
                color: "border-amber-200 bg-amber-50",
                dot: "bg-amber-400",
                desc: "Changes waiting for your approval or rejection.",
              },
              {
                label: "Approved",
                color: "border-emerald-200 bg-emerald-50",
                dot: "bg-emerald-400",
                desc: "Changes you've signed off on. Implementation is queued.",
              },
              {
                label: "Implemented",
                color: "border-indigo-200 bg-indigo-50",
                dot: "bg-indigo-400",
                desc: "Changes that have been applied to your live site.",
              },
            ].map((col) => (
              <div key={col.label} className={`rounded-lg border px-4 py-3 ${col.color}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                  <span className="text-[12px] font-semibold text-slate-800">{col.label}</span>
                </div>
                <p className="text-[12px] text-slate-600 leading-relaxed">{col.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Approvals */}
      <GlassCard className="overflow-hidden">
        <div className="p-5">
          <SectionLabel>Approvals</SectionLabel>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            Approvals are your primary responsibility. Nothing is applied to your site without your sign-off.
            The view uses a two-pane layout — the left lists all pending changes, clicking one opens the full
            detail on the right. Aim to review at least once a week.
          </p>
        </div>

        <Divider />

        {/* Change categories */}
        <div className="px-5 py-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Change categories</div>
          <div className="space-y-1">
            {[
              {
                label: "Technical",
                desc: "robots.txt rules, canonical tags, image alt text, broken link fixes, and redirects.",
              },
              {
                label: "On-Page",
                desc: "Title tags, meta descriptions, and heading structure (H1–H4).",
              },
              {
                label: "Content",
                desc: "Thin or outdated content flags, internal linking improvements, and content pruning recommendations.",
              },
              {
                label: "AI-GEO",
                desc: "Schema markup (Organization, LocalBusiness, FAQ, Article) and location signals to improve visibility in AI-powered search results.",
              },
            ].map((cat) => (
              <details key={cat.label} className="group">
                <summary className="cursor-pointer flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors list-none select-none">
                  {cat.label}
                  <Chevron />
                </summary>
                <div className="px-3 pb-3">
                  <p className="text-[13px] text-slate-500 leading-relaxed">{cat.desc}</p>
                </div>
              </details>
            ))}
          </div>
        </div>

        <Divider />

        {/* Actions */}
        <div className="px-5 py-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">What each action does</div>
          <div className="space-y-1">
            {[
              {
                label: "Approve",
                desc: "You're satisfied with the change. It moves immediately to implementation.",
              },
              {
                label: "Skip",
                desc: "Pass on this change for now. It won't be removed — you can come back to it.",
              },
              {
                label: "Ask a question",
                desc: "Flag the change with a note for our team. We'll review and respond before re-presenting it.",
              },
              {
                label: "Mark as manual",
                desc: "The change needs to be handled outside the automated system — either by you or our team.",
              },
            ].map((action) => (
              <details key={action.label} className="group">
                <summary className="cursor-pointer flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors list-none select-none">
                  {action.label}
                  <Chevron />
                </summary>
                <div className="px-3 pb-3">
                  <p className="text-[13px] text-slate-500 leading-relaxed">{action.desc}</p>
                </div>
              </details>
            ))}
          </div>
        </div>

        <Divider />

        {/* Confidence */}
        <div className="px-5 py-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Confidence level</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
              <div className="text-[12px] font-semibold text-emerald-700 mb-1">High confidence</div>
              <p className="text-[12px] text-slate-600 leading-relaxed">
                Well-supported by data. Safe to approve without deep review.
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <div className="text-[12px] font-semibold text-amber-700 mb-1">Low confidence</div>
              <p className="text-[12px] text-slate-600 leading-relaxed">
                Less certain. Read the before/after carefully before approving.
              </p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Content Pipeline */}
      <GlassCard className="overflow-hidden">
        <div className="p-5">
          <SectionLabel>Content pipeline</SectionLabel>
          <p className="text-sm text-slate-600 leading-relaxed">
            The Content section manages your blog strategy — from keyword research through to published articles.
          </p>
        </div>

        <Divider />

        <div className="divide-y divide-slate-100">
          {[
            {
              title: "Title Proposals",
              desc: "Each month, our AI proposes 2–4 blog post titles based on your keyword groups. Review them in the Title Proposals view and approve or reject each one. Approved titles trigger content generation — a full article is drafted and staged for publishing.",
            },
            {
              title: "Content Pipeline",
              desc: "Shows all content at each stage of production: Queued, In Progress, and Completed. Articles are published to your site as drafts — never live without your review.",
            },
            {
              title: "Keywords",
              desc: "Your keyword groups are the topic pillars your content strategy is built around. Each group represents a cluster of related terms we're targeting for your site.",
            },
            {
              title: "Content Profile",
              desc: "The data that shapes your content's tone, target audience, and style — pulled from your onboarding and updated over time.",
            },
          ].map((item) => (
            <details key={item.title} className="group">
              <summary className="cursor-pointer flex items-center justify-between px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors list-none select-none">
                {item.title}
                <Chevron />
              </summary>
              <div className="px-5 pb-4">
                <p className="text-[13px] text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </details>
          ))}
        </div>
      </GlassCard>

      {/* Reports + Activity */}
      <div className="grid grid-cols-2 gap-6">
        <GlassCard>
          <div className="p-5">
            <SectionLabel>Monthly reports</SectionLabel>
            <p className="text-[13px] text-slate-600 leading-relaxed mb-4">
              Generated automatically every month. No action required.
            </p>
            <div className="space-y-2">
              {[
                "Changes implemented that month",
                "Clicks, impressions, and rankings from Google Search Console",
                "Content queue and upcoming articles",
                "Priorities for the following month",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-[13px] text-slate-600">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-5">
            <SectionLabel>Activity log</SectionLabel>
            <p className="text-[13px] text-slate-600 leading-relaxed mb-4">
              A complete, timestamped record of every change made to your site through this system.
              Each entry shows:
            </p>
            <div className="space-y-2">
              {[
                "When the change was made",
                "What was changed (before and after values)",
                "Which page was affected",
                "Category and final status",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-[13px] text-slate-600">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Status reference */}
      <GlassCard>
        <div className="p-5">
          <SectionLabel>Status reference</SectionLabel>
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 w-44">
                    Status
                  </th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Meaning
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  ["Pending", "amber", "Awaiting your approval."],
                  ["Approved", "emerald", "You approved it — implementation is queued."],
                  ["In Progress", "indigo", "Currently being implemented on your site."],
                  ["Complete", "slate", "Successfully applied to your live site."],
                  ["Manual Required", "amber", "Needs implementation outside the automated system."],
                  ["Design Review", "violet", "Flagged for visual review before going live."],
                  ["Skipped", "slate", "You passed on this change."],
                  ["Reverted", "slate", "Change was rolled back to its original state."],
                ].map(([status, color, meaning]) => (
                  <tr key={status} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          color === "amber" ? "bg-amber-400" :
                          color === "emerald" ? "bg-emerald-400" :
                          color === "indigo" ? "bg-indigo-400" :
                          color === "violet" ? "bg-violet-400" :
                          "bg-slate-300"
                        }`} />
                        <span className="text-[13px] font-medium text-slate-800">{status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-slate-500 align-top">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </GlassCard>

    </div>
  );
}
