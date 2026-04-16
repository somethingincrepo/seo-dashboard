import { notFound } from "next/navigation";
import { getClientByToken } from "@/lib/clients";
import { GlassCard } from "@/components/ui/GlassCard";

export const revalidate = 0;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-100" />;
}

// Self-contained expandable item — summary and content visually unified
function AccordionItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group border border-slate-150 rounded-lg overflow-hidden">
      <summary className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer select-none list-none hover:bg-slate-100 transition-colors">
        <span className="text-[13px] font-semibold text-slate-700">{label}</span>
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
      </summary>
      <div className="px-4 py-3 text-[13px] text-slate-600 leading-relaxed border-t border-slate-100 bg-white">
        {children}
      </div>
    </details>
  );
}

const TOC_SECTIONS = [
  { id: "how-it-works", label: "How it works" },
  { id: "quick-reference", label: "Quick reference" },
  { id: "dashboard", label: "Dashboard" },
  { id: "approvals", label: "Approvals" },
  { id: "content", label: "Content pipeline" },
  { id: "content-refreshes", label: "Content refreshes" },
  { id: "reports", label: "Reports" },
  { id: "activity", label: "Activity log" },
  { id: "statuses", label: "Statuses" },
];

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
    <div className="w-full flex gap-10">

      {/* ── Sticky TOC ── */}
      <nav className="hidden lg:block w-44 shrink-0">
        <div className="sticky top-8 space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-2">
            On this page
          </div>
          {TOC_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block px-2 py-1.5 text-[12px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Guide</h1>
          <p className="text-base text-slate-500 mt-1">A complete reference for your SEO portal</p>
        </div>

        {/* How It Works */}
        <section id="how-it-works">
          <GlassCard>
            <div className="p-6">
              <SectionLabel>How it works</SectionLabel>
              <p className="text-sm text-slate-600 leading-relaxed mb-5">
                Your SEO program runs as a continuous loop. The system does the heavy lifting — you stay in
                control through a simple approval process. Nothing changes on your site without your sign-off.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    step: "01",
                    title: "Audit",
                    body: "Your site is scanned each month. Our system reviews every page across technical health, on-page SEO, content quality, and AI-visibility signals — then surfaces specific, prioritized improvements.",
                    color: "text-indigo-600",
                    bg: "bg-indigo-50",
                    border: "border-indigo-100",
                  },
                  {
                    step: "02",
                    title: "You Approve",
                    body: "Every proposed change appears in your Approvals queue with a clear before-and-after. You decide: approve it, skip it, or ask a question. Nothing goes live without your sign-off.",
                    color: "text-amber-600",
                    bg: "bg-amber-50",
                    border: "border-amber-100",
                  },
                  {
                    step: "03",
                    title: "We Implement",
                    body: "Approved changes are applied directly to your live site. On WordPress this is fully automatic. On other platforms our team handles implementation and updates the status in your dashboard.",
                    color: "text-emerald-600",
                    bg: "bg-emerald-50",
                    border: "border-emerald-100",
                  },
                ].map((item) => (
                  <div key={item.step} className={`rounded-xl border p-5 ${item.bg} ${item.border}`}>
                    <div className={`text-[10px] font-bold tracking-widest mb-2.5 ${item.color}`}>
                      STEP {item.step}
                    </div>
                    <div className="text-[13px] font-bold text-slate-900 mb-2">{item.title}</div>
                    <p className="text-[12px] text-slate-600 leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Quick Reference */}
        <section id="quick-reference">
          <GlassCard>
            <div className="p-6">
              <SectionLabel>Quick reference</SectionLabel>
            </div>
            <Divider />
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <div className="p-6">
                <div className="text-[12px] font-semibold text-slate-700 mb-3">Your responsibilities</div>
                <div className="space-y-3">
                  {[
                    {
                      label: "Weekly",
                      item: "Review pending changes in Approvals. Approve, skip, or ask questions on anything in your queue.",
                    },
                    {
                      label: "Monthly",
                      item: "Review and approve title proposals for upcoming blog content.",
                    },
                    {
                      label: "Anytime",
                      item: "Ask questions on any change — our team reviews flagged items and will follow up.",
                    },
                  ].map(({ label, item }) => (
                    <div key={label} className="flex gap-3 text-[13px]">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 pt-0.5 w-14 shrink-0">{label}</span>
                      <span className="text-slate-600 leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6">
                <div className="text-[12px] font-semibold text-slate-700 mb-3">What's fully automatic</div>
                <div className="space-y-2">
                  {[
                    "Monthly SEO audit of your entire site",
                    "Implementation of approved changes (WordPress)",
                    "Blog title proposals — 2 to 4 per month",
                    "Monthly performance reports",
                    "Content generation for approved titles",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-[13px] text-slate-600">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Dashboard */}
        <section id="dashboard">
          <GlassCard>
            <div className="p-6">
              <SectionLabel>Dashboard — pipeline board</SectionLabel>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                The main dashboard shows a Kanban board with every proposed change for your site. Each card
                represents a single SEO improvement. Click any card to open the detail view, where you can
                see exactly what's being changed, why it matters, and take an action.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "To Review",
                    dot: "bg-amber-400",
                    bg: "bg-amber-50",
                    border: "border-amber-200",
                    desc: "Changes waiting for your approval. This is your active queue. Aim to clear it at least once a week.",
                  },
                  {
                    label: "Approved",
                    dot: "bg-emerald-400",
                    bg: "bg-emerald-50",
                    border: "border-emerald-200",
                    desc: "Changes you've signed off on. Implementation is queued and will begin automatically.",
                  },
                  {
                    label: "Implemented",
                    dot: "bg-indigo-400",
                    bg: "bg-indigo-50",
                    border: "border-indigo-200",
                    desc: "Changes that have been applied to your live site. These are done — no action needed.",
                  },
                ].map((col) => (
                  <div key={col.label} className={`rounded-xl border px-5 py-4 ${col.bg} ${col.border}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                      <span className="text-[12px] font-bold text-slate-800">{col.label}</span>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed">{col.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Approvals */}
        <section id="approvals">
          <GlassCard className="overflow-hidden">
            <div className="p-6">
              <SectionLabel>Approvals</SectionLabel>
              <p className="text-sm text-slate-600 leading-relaxed">
                Approvals is your most important tool. Every SEO change identified for your site lands here first.
                The view uses a two-pane layout — the left lists all pending changes grouped by category, clicking
                any one opens the full detail on the right with a before-and-after comparison.
              </p>
            </div>

            <Divider />

            {/* Categories */}
            <div className="p-6">
              <div className="text-[12px] font-semibold text-slate-700 mb-3">Change categories</div>
              <p className="text-[13px] text-slate-500 mb-4 leading-relaxed">
                Every change belongs to one of four categories. Use the category tabs in Approvals to focus on
                one area at a time. Click a category below to see what it covers.
              </p>
              <div className="space-y-2">
                <AccordionItem label="Technical">
                  <p className="mb-2">Technical changes fix foundational issues that affect how search engines crawl and index your site. These are often invisible to visitors but critical for rankings.</p>
                  <div className="space-y-1.5 mt-3">
                    {[
                      ["robots.txt", "Controls which pages search engines can access. Issues here can accidentally block important pages."],
                      ["Canonical tags", "Tells search engines which version of a page is the 'real' one, preventing duplicate content penalties."],
                      ["Alt text", "Text descriptions on images. Helps search engines understand image content and improves accessibility."],
                      ["Broken links", "Internal links pointing to pages that no longer exist, hurting crawlability and user experience."],
                      ["Redirects", "Ensures old URLs properly forward to new ones so traffic and ranking signals are preserved."],
                    ].map(([term, def]) => (
                      <div key={String(term)} className="grid grid-cols-[120px_1fr] gap-2">
                        <span className="text-[12px] font-medium text-slate-700">{term}</span>
                        <span className="text-[12px] text-slate-500">{def}</span>
                      </div>
                    ))}
                  </div>
                </AccordionItem>

                <AccordionItem label="On-Page">
                  <p className="mb-3">On-page changes improve how each page is described and structured — directly impacting what shows up in search results and how search engines rank the page.</p>
                  <div className="space-y-1.5">
                    {[
                      ["Title tags", "The headline that appears in Google search results. Heavily weighted by search engines and the first thing users see."],
                      ["Meta descriptions", "The summary text below the title in search results. Improves click-through rate when written well."],
                      ["Heading structure", "H1–H4 headings organize page content for search engines and readers. A clear hierarchy improves rankings and readability."],
                    ].map(([term, def]) => (
                      <div key={String(term)} className="grid grid-cols-[120px_1fr] gap-2">
                        <span className="text-[12px] font-medium text-slate-700">{term}</span>
                        <span className="text-[12px] text-slate-500">{def}</span>
                      </div>
                    ))}
                  </div>
                </AccordionItem>

                <AccordionItem label="Content">
                  <p className="mb-3">Content changes address the substance of your site's pages — ensuring the content is relevant, current, and well-linked.</p>
                  <div className="space-y-1.5">
                    {[
                      ["Thin content", "Pages with too little content to rank. We flag these and recommend expanding or consolidating them."],
                      ["Outdated content", "Pages that haven't been updated in 18+ months and may be losing rankings as a result."],
                      ["Internal links", "Links between your own pages. Adding relevant internal links distributes ranking authority and helps users navigate."],
                      ["Content pruning", "Pages with no traffic, no backlinks, and low relevance — candidates for removal or consolidation to keep the site lean."],
                    ].map(([term, def]) => (
                      <div key={String(term)} className="grid grid-cols-[130px_1fr] gap-2">
                        <span className="text-[12px] font-medium text-slate-700">{term}</span>
                        <span className="text-[12px] text-slate-500">{def}</span>
                      </div>
                    ))}
                  </div>
                </AccordionItem>

                <AccordionItem label="AI-GEO">
                  <p className="mb-3">AI-GEO changes optimize your site for AI-powered search tools like ChatGPT, Perplexity, and Google's AI Overviews — in addition to traditional search engines.</p>
                  <div className="space-y-1.5">
                    {[
                      ["Organization schema", "Structured data that tells AI systems and search engines who your business is, what it does, and how to contact you."],
                      ["LocalBusiness schema", "Location-based structured data critical for businesses serving a geographic area."],
                      ["FAQ schema", "Marks up question-and-answer content so it can be surfaced directly in search results and AI answers."],
                      ["Article schema", "Signals that a page is a piece of editorial content, helping it appear in AI-generated content summaries."],
                      ["Location signals", "Explicit mentions of service areas, addresses, and geographic context that AI models use to match local queries."],
                    ].map(([term, def]) => (
                      <div key={String(term)} className="grid grid-cols-[150px_1fr] gap-2">
                        <span className="text-[12px] font-medium text-slate-700">{term}</span>
                        <span className="text-[12px] text-slate-500">{def}</span>
                      </div>
                    ))}
                  </div>
                </AccordionItem>
              </div>
            </div>

            <Divider />

            {/* Actions */}
            <div className="p-6">
              <div className="text-[12px] font-semibold text-slate-700 mb-3">What each action does</div>
              <div className="space-y-2">
                <AccordionItem label="Approve">
                  You're satisfied with the proposed change. It moves immediately to implementation. On
                  WordPress, this happens automatically — no further action needed on your end. On other
                  platforms, the change is flagged for our team to implement manually.
                </AccordionItem>
                <AccordionItem label="Skip">
                  You're passing on this change for now. It leaves your active queue but is not discarded —
                  you can still find it in your history. Use Skip when a change isn't wrong, just not a
                  priority right now.
                </AccordionItem>
                <AccordionItem label="Ask a question">
                  Something looks off or you want more context before deciding. Flagging with a question
                  sends it to our team for review. We'll add context or adjust the proposal and return it
                  to your queue.
                </AccordionItem>
                <AccordionItem label="Mark as manual">
                  The change is valid but can't go through the automated system — perhaps because of a
                  custom CMS setup or a specific workflow on your end. This marks it for human handling
                  and removes it from the automation queue.
                </AccordionItem>
              </div>
            </div>

            <Divider />

            {/* Confidence */}
            <div className="p-6">
              <div className="text-[12px] font-semibold text-slate-700 mb-3">Confidence levels</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-5 py-4">
                  <div className="text-[12px] font-bold text-emerald-700 mb-1.5">High confidence</div>
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    The change is well-supported by data — GSC signals, page analysis, or industry best
                    practices. Safe to approve without needing to read deeply into every detail.
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-5 py-4">
                  <div className="text-[12px] font-bold text-amber-700 mb-1.5">Low confidence</div>
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    The signal is weaker or the change involves more judgment. Read the before-and-after
                    carefully and consider asking a question if anything looks wrong.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Content Pipeline */}
        <section id="content">
          <GlassCard className="overflow-hidden">
            <div className="p-6">
              <SectionLabel>Content pipeline</SectionLabel>
              <p className="text-sm text-slate-600 leading-relaxed">
                The Content section manages your blog strategy from end to end — keyword research, title
                ideation, article generation, and publication. Each sub-section has a specific role.
              </p>
            </div>
            <Divider />
            <div className="p-6 space-y-2">
              <AccordionItem label="Title Proposals">
                <p className="mb-3">
                  Each month our system generates 2–4 proposed blog titles based on your keyword groups and
                  competitive gaps. You review them here and approve or reject each one.
                </p>
                <p className="mb-3">
                  Approved titles move into content generation — a full article is drafted using your site's
                  tone, audience, and keyword targeting. The article is staged as a WordPress draft, never
                  published automatically.
                </p>
                <p>
                  To avoid flooding the queue, the system will pause title generation if you have 5 or more
                  titles already waiting for approval.
                </p>
              </AccordionItem>
              <AccordionItem label="Content Pipeline">
                <p className="mb-3">
                  A Kanban board showing all content at each stage of production. Statuses:
                </p>
                <div className="space-y-1.5">
                  {[
                    ["Queued", "Title approved and waiting for the generation system to pick it up."],
                    ["In Progress", "Article is being drafted. This typically takes 5–10 minutes."],
                    ["Completed", "Article is drafted and staged in WordPress as a draft, ready for your review before publishing."],
                  ].map(([label, desc]) => (
                    <div key={String(label)} className="grid grid-cols-[90px_1fr] gap-2">
                      <span className="text-[12px] font-medium text-slate-700">{label}</span>
                      <span className="text-[12px] text-slate-500">{desc}</span>
                    </div>
                  ))}
                </div>
              </AccordionItem>
              <AccordionItem label="Keywords">
                <p className="mb-2">
                  Your keyword groups are the strategic foundation of your content program. Each group is a
                  cluster of related search terms around a single topic pillar — built from a combination of
                  search volume data, competition analysis, and your site's existing coverage.
                </p>
                <p>
                  These groups determine which topics we write about and in what order. They're updated
                  periodically as new opportunities emerge.
                </p>
              </AccordionItem>
              <AccordionItem label="Content Profile">
                <p>
                  The data that shapes how your content is written — your target audience, preferred tone
                  (e.g. B2B professional, conversational, technical), and business context. This is pulled
                  from your onboarding and informs every article generated for your site. Contact our team
                  if anything here needs updating.
                </p>
              </AccordionItem>
            </div>
          </GlassCard>
        </section>

        {/* Content Refreshes */}
        <section id="content-refreshes">
          <GlassCard className="overflow-hidden">
            <div className="p-6">
              <SectionLabel>Content refreshes</SectionLabel>
              <p className="text-sm text-slate-600 leading-relaxed">
                Each month we identify existing pages on your site that are underperforming and update them
                to improve keyword coverage, strengthen headings, and sharpen body copy. Updated drafts appear
                in the <strong className="text-slate-700">Content Refreshes</strong> tab for your review before anything goes live.
              </p>
            </div>
            <Divider />
            <div className="p-6 space-y-2">
              <AccordionItem label="What gets refreshed">
                <p className="mb-3">
                  We look at two types of pages each month:
                </p>
                <div className="space-y-2 mb-3">
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-[12px] font-medium text-slate-700">Blog posts</span>
                    <span className="text-[12px] text-slate-500">Existing articles that have lost rankings or are missing keywords competitors are capturing. We rewrite the content to be more comprehensive and better targeted.</span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="text-[12px] font-medium text-slate-700">Service pages</span>
                    <span className="text-[12px] text-slate-500">Core pages that are ranking but not converting at their potential — thin body copy, weak headings, or keyword gaps compared to top-ranking competitors.</span>
                  </div>
                </div>
                <p className="text-[12px] text-slate-500">
                  Pages are selected based on their current keyword coverage, GSC performance, and how long it has been since they were last updated.
                </p>
              </AccordionItem>

              <AccordionItem label="Monthly allocation">
                <p className="mb-3">
                  The number of content refreshes per month depends on your plan:
                </p>
                <div className="space-y-1.5">
                  {[
                    ["Starter", "2 refreshes per month"],
                    ["Growth", "4 refreshes per month"],
                    ["Authority", "8 refreshes per month"],
                  ].map(([plan, desc]) => (
                    <div key={plan} className="grid grid-cols-[80px_1fr] gap-2">
                      <span className="text-[12px] font-medium text-slate-700">{plan}</span>
                      <span className="text-[12px] text-slate-500">{desc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-slate-500 mt-3">
                  Refresh candidates are identified during the monthly site audit. They appear in the Content Refreshes tab once the updated draft is ready for your review.
                </p>
              </AccordionItem>

              <AccordionItem label="How to review and approve">
                <p className="mb-3">
                  Go to <strong className="text-slate-700">Content Refreshes</strong> in the sidebar. Each refresh shows:
                </p>
                <div className="space-y-1.5 mb-3">
                  {[
                    ["Current page", "The live version fetched directly from your site — headlines, body copy, and meta tags."],
                    ["Updated draft", "The new version we've written, with improved headings, expanded content, and better keyword targeting."],
                  ].map(([label, desc]) => (
                    <div key={label} className="grid grid-cols-[110px_1fr] gap-2">
                      <span className="text-[12px] font-medium text-slate-700">{label}</span>
                      <span className="text-[12px] text-slate-500">{desc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-slate-500">
                  Click <strong className="text-slate-700">Approve &amp; Publish</strong> to push the updated version live. On WordPress this happens automatically. The original is never deleted — just replaced.
                </p>
              </AccordionItem>

              <AccordionItem label="Tracking progress">
                <p className="mb-2">
                  The top of the Content Refreshes page shows a monthly progress tracker with counts for each status:
                </p>
                <div className="space-y-1.5">
                  {[
                    ["Scheduled", "Identified and queued — the updated draft is being prepared."],
                    ["In Progress", "The page is actively being rewritten."],
                    ["Ready to Review", "The draft is ready — your approval is needed before it goes live."],
                    ["Approved", "You've signed off and the update is live or queued to publish."],
                  ].map(([status, desc]) => (
                    <div key={status} className="grid grid-cols-[130px_1fr] gap-2">
                      <span className="text-[12px] font-medium text-slate-700">{status}</span>
                      <span className="text-[12px] text-slate-500">{desc}</span>
                    </div>
                  ))}
                </div>
              </AccordionItem>
            </div>
          </GlassCard>
        </section>

        {/* Reports */}
        <section id="reports">
          <GlassCard>
            <div className="p-6">
              <SectionLabel>Monthly reports</SectionLabel>
              <p className="text-sm text-slate-600 leading-relaxed mb-5">
                A performance report is generated automatically at the end of each month. No action required —
                it will appear in your Reports tab when ready. Each report includes:
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    title: "Changes summary",
                    desc: "A breakdown of every change implemented that month — what was changed, which page, and what category it fell under.",
                  },
                  {
                    title: "Search performance",
                    desc: "Clicks, impressions, average position, and click-through rate from Google Search Console. Compared to the prior month with delta indicators.",
                  },
                  {
                    title: "Ranking movement",
                    desc: "Keywords that moved up or down in rankings, and which pages gained or lost the most traffic month-over-month.",
                  },
                  {
                    title: "Content activity",
                    desc: "Articles published this month, any that started ranking in Google, and what's currently in the content queue.",
                  },
                  {
                    title: "Next month priorities",
                    desc: "The top 5 focus areas for the coming month, based on what data shows will have the highest impact.",
                  },
                  {
                    title: "AI referral traffic",
                    desc: "Sessions arriving from AI platforms like ChatGPT, Perplexity, and Gemini — tracked as your AI-GEO visibility builds over time.",
                  },
                ].map(({ title, desc }) => (
                  <div key={title} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3.5">
                    <div className="text-[12px] font-semibold text-slate-800 mb-1">{title}</div>
                    <p className="text-[12px] text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Activity */}
        <section id="activity">
          <GlassCard>
            <div className="p-6">
              <SectionLabel>Activity log</SectionLabel>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                The Activity Log is a complete, timestamped audit trail of everything that has happened on
                your SEO program — changes implemented, titles proposed, articles completed, and reports
                delivered. It's read-only and always up to date.
              </p>
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {["Column", "What it shows"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[
                      ["Date & Time", "When the event was recorded."],
                      ["Change", "What was modified — e.g. 'Title tag updated' or 'FAQ schema added'."],
                      ["Page", "The specific URL on your site that was affected."],
                      ["Category", "Technical, On-Page, Content, or AI-GEO."],
                      ["Status", "The outcome: Implemented, Reverted, Skipped, etc."],
                    ].map(([col, desc]) => (
                      <tr key={String(col)} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-700 w-40">{col}</td>
                        <td className="px-4 py-2.5 text-slate-500">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Statuses */}
        <section id="statuses">
          <GlassCard>
            <div className="p-6">
              <SectionLabel>Status reference</SectionLabel>
              <p className="text-sm text-slate-600 leading-relaxed mb-5">
                Every change card and activity entry has a status. Here's what each one means.
              </p>
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {["Status", "Meaning", "Action needed?"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[
                      ["Pending", "amber", "Awaiting your approval.", "Yes — review and decide."],
                      ["Approved", "emerald", "You approved it. Implementation is queued.", "No — we take it from here."],
                      ["In Progress", "indigo", "Currently being implemented on your site.", "No."],
                      ["Complete", "slate-dark", "Successfully applied to your live site.", "No."],
                      ["Manual Required", "amber", "Needs implementation outside the automated system.", "Sometimes — our team will follow up."],
                      ["Design Review", "violet", "Flagged for visual verification before going live.", "No — our team handles this."],
                      ["Skipped", "slate", "You passed on this change.", "No — revisit anytime via Activity."],
                      ["Reverted", "slate", "The change was rolled back to its original state.", "No."],
                    ].map(([status, color, meaning, action]) => (
                      <tr key={String(status)} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-4 py-3 align-top w-40">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              color === "amber" ? "bg-amber-400" :
                              color === "emerald" ? "bg-emerald-400" :
                              color === "indigo" ? "bg-indigo-400" :
                              color === "violet" ? "bg-violet-400" :
                              color === "slate-dark" ? "bg-slate-500" :
                              "bg-slate-300"
                            }`} />
                            <span className="text-[13px] font-semibold text-slate-800">{status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-slate-500 align-top">{meaning}</td>
                        <td className="px-4 py-3 text-[12px] text-slate-500 align-top">{action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </GlassCard>
        </section>

      </div>
    </div>
  );
}
