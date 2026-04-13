"use client";

interface HowToUseModalProps {
  onClose: () => void;
}

export function HowToUseModal({ onClose }: HowToUseModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Document panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">How to Use This Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Your complete guide to the SEO Client Portal</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors text-xl leading-none ml-4 shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-8 py-7 space-y-10 text-[14px] text-slate-700 leading-relaxed">

          {/* Section 1 */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              1. What Is This Dashboard?
            </h2>
            <p className="mb-3">
              This portal gives you full visibility into your automated SEO management program. Your website is
              continuously audited, improved, and monitored — and this dashboard is your window into everything
              that's happening.
            </p>
            <p className="mb-3">The system operates as a three-phase loop:</p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>
                <span className="font-medium">Audit</span> — We scan your site monthly and identify SEO improvements.
              </li>
              <li>
                <span className="font-medium">You Approve</span> — Proposed changes appear in your dashboard for your review.
              </li>
              <li>
                <span className="font-medium">We Implement</span> — Once approved, changes are applied to your site
                (automatically on WordPress).
              </li>
            </ol>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              2. Your Dashboard (Pipeline Board)
            </h2>
            <p className="mb-3">The main dashboard shows a Kanban-style board with three columns:</p>
            <ul className="space-y-2 pl-1 mb-4">
              <li>
                <span className="font-medium text-slate-800">To Review</span> — Changes waiting for your approval or rejection.
              </li>
              <li>
                <span className="font-medium text-slate-800">Approved</span> — Changes you've approved; implementation is queued.
              </li>
              <li>
                <span className="font-medium text-slate-800">Implemented</span> — Changes that have been applied to your site.
              </li>
            </ul>
            <p>
              Each card represents a single proposed SEO change. Click a card to open the detail panel, where you
              can see exactly what is being changed and why. Cards are color-coded and tagged by category (Technical,
              On-Page, Content, AI-GEO) so you can quickly identify the type of change.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              3. Approvals — Your Most Important Job
            </h2>
            <p className="mb-5">
              Approvals are how you stay in control. Nothing is applied to your site without your sign-off. Aim to
              review pending changes at least once a week.
            </p>

            <h3 className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide mb-2.5">Change Categories</h3>
            <ul className="space-y-2.5 mb-6 pl-1">
              <li>
                <span className="font-medium text-slate-900">Technical</span> — robots.txt rules, canonical tags,
                image alt text, broken link fixes, and redirects.
              </li>
              <li>
                <span className="font-medium text-slate-900">On-Page</span> — Title tags, meta descriptions, and
                heading structure (H1–H4).
              </li>
              <li>
                <span className="font-medium text-slate-900">Content</span> — Flagging thin or outdated content,
                improving internal linking, and content pruning recommendations.
              </li>
              <li>
                <span className="font-medium text-slate-900">AI-GEO</span> — Schema markup (Organization,
                LocalBusiness, FAQ, Article) and location signals to improve visibility in AI-powered search results.
              </li>
            </ul>

            <h3 className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide mb-2.5">What to Look at on Each Card</h3>
            <ul className="list-disc list-inside space-y-1.5 pl-1 mb-6">
              <li>
                <span className="font-medium">Current value vs. proposed value</span> — See exactly what is changing.
              </li>
              <li>
                <span className="font-medium">Confidence level</span> — High = very safe to approve without deep
                review. Low = take an extra look before approving.
              </li>
              <li>
                <span className="font-medium">Category</span> — Identifies the type of SEO work being done.
              </li>
            </ul>

            <h3 className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide mb-2.5">Your Approval Actions</h3>
            <ul className="list-disc list-inside space-y-1.5 pl-1 mb-6">
              <li>
                <span className="font-medium">Approve</span> — You're happy with the change; it moves to implementation.
              </li>
              <li>
                <span className="font-medium">Skip</span> — Pass on this change for now without rejecting it outright.
              </li>
              <li>
                <span className="font-medium">Ask a Question</span> — Flag the change with a question for our team.
              </li>
              <li>
                <span className="font-medium">Mark as Manual</span> — Note that this change needs to be handled
                outside the automated system.
              </li>
            </ul>

            <h3 className="text-[12px] font-semibold text-slate-600 uppercase tracking-wide mb-2.5">After You Approve</h3>
            <p>
              For WordPress sites, approved changes are implemented automatically — no action needed on your end.
              For other CMS platforms, approved changes are flagged for manual implementation by our team and
              you'll see the status update accordingly.
            </p>
            <p className="mt-2">
              The approvals view uses a two-pane layout: the left side lists all pending changes; clicking one
              opens the full detail on the right.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              4. Content Pipeline
            </h2>
            <ul className="space-y-3 pl-1">
              <li>
                <span className="font-medium text-slate-900">Title Proposals</span> — Each month, our AI proposes
                2–4 blog post titles based on your keyword strategy. You review them and approve or reject each one.
                Approved titles move into content generation.
              </li>
              <li>
                <span className="font-medium text-slate-900">Content Pipeline</span> — Shows all content at each
                production stage: Queued → In Progress → Completed.
              </li>
              <li>
                <span className="font-medium text-slate-900">Keywords</span> — Your keyword groups are the topic
                pillars your entire content strategy is built around. Review these to understand what subjects
                we're targeting for your site.
              </li>
              <li>
                <span className="font-medium text-slate-900">Content Profile</span> — The data and preferences
                that shape your content's tone, audience targeting, and style.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              5. Monthly Reports
            </h2>
            <p className="mb-3">A performance report is generated automatically each month. It includes:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-1">
              <li>A summary of all changes implemented that month.</li>
              <li>
                SEO performance trends — clicks, impressions, and keyword rankings pulled directly from your
                Google Search Console data.
              </li>
              <li>Your content queue status and upcoming content plan.</li>
              <li>Priorities and focus areas for the following month.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              6. Activity Log
            </h2>
            <p>
              The Activity Log is a complete, timestamped history of every change made to your site through this
              system. Each entry shows the before and after values so you always have a clear audit trail of what
              was changed and when.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              7. Your Responsibilities (Quick Reference)
            </h2>
            <p className="font-medium text-slate-800 mb-2.5">Things you should do:</p>
            <ul className="space-y-2 pl-1 mb-5">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold mt-0.5 shrink-0">✓</span>
                <span>Review and approve (or skip) pending changes — aim for at least once a week.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold mt-0.5 shrink-0">✓</span>
                <span>Review title proposals each month and approve the ones you want published.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold mt-0.5 shrink-0">✓</span>
                <span>Ask questions if anything looks wrong or unclear — we're here to help.</span>
              </li>
            </ul>
            <p className="font-medium text-slate-800 mb-2.5">Things you do NOT need to do:</p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 font-bold mt-0.5 shrink-0">✕</span>
                <span>You do <span className="font-medium">not</span> need to implement changes manually — we handle that.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 font-bold mt-0.5 shrink-0">✕</span>
                <span>You do <span className="font-medium">not</span> need to generate reports — they're produced automatically.</span>
              </li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              8. What Happens Automatically
            </h2>
            <p className="mb-3">The following happens on your behalf without any action required from you:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-1">
              <li>Monthly SEO audit of your entire site.</li>
              <li>Keyword research and content strategy updates.</li>
              <li>Blog title proposals (2–4 per month).</li>
              <li>Monthly performance reports.</li>
              <li>Implementation of approved changes (fully automatic for WordPress sites).</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 pb-1.5 border-b border-slate-100">
              9. Understanding Statuses
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-8 font-semibold text-slate-700 w-44">Status</th>
                    <th className="text-left py-2 font-semibold text-slate-700">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ["Pending", "Awaiting your approval."],
                    ["Approved", "You approved it; implementation is queued."],
                    ["In Progress", "Currently being implemented."],
                    ["Complete", "Successfully applied to your site."],
                    ["Manual Required", "Needs human implementation (non-WordPress sites)."],
                    ["Skipped", "You passed on this change."],
                  ].map(([status, meaning]) => (
                    <tr key={status}>
                      <td className="py-2 pr-8 font-medium text-slate-800 align-top">{status}</td>
                      <td className="py-2 text-slate-600 align-top">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer */}
          <div className="pt-2 pb-1 border-t border-slate-100 text-[12px] text-slate-400 text-center">
            Questions? Use the "Book a meeting" button in the sidebar to schedule time with our team.
          </div>

        </div>
      </div>
    </div>
  );
}
