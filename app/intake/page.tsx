"use client";

import { useState } from "react";
import { PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";

// ─── constants ────────────────────────────────────────────────────────────────

const PACKAGE_TIER_ORDER: PackageTier[] = ["starter", "growth", "authority"];

const PACKAGE_COLORS: Record<PackageTier, { border: string; bg: string; label: string; dot: string }> = {
  starter:   { border: "border-slate-400",  bg: "bg-slate-50",  label: "text-slate-700",  dot: "bg-slate-400"  },
  growth:    { border: "border-indigo-500", bg: "bg-indigo-50", label: "text-indigo-700", dot: "bg-indigo-500" },
  authority: { border: "border-violet-500", bg: "bg-violet-50", label: "text-violet-700", dot: "bg-violet-500" },
};

const CMS_OPTIONS = ["WordPress", "Shopify", "Webflow", "HubSpot", "Squarespace", "Wix", "Framer", "Custom / Other"];
const SEO_PLUGIN_OPTIONS = ["Yoast", "RankMath", "AIOSEO", "None", "Other"];
const PAGE_BUILDER_OPTIONS = ["Elementor", "Divi", "Gutenberg", "Beaver Builder", "Webflow Native", "None", "Other"];
const REPORT_DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const APPROVAL_OPTIONS = ["24 hours", "48 hours", "1 week"];

// ─── sub-components ───────────────────────────────────────────────────────────

const inputClass =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white placeholder:text-slate-400 transition-shadow";

const textareaClass =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white placeholder:text-slate-400 resize-none transition-shadow";

const selectClass =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white transition-shadow appearance-none";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{" "}
        {required && <span className="text-red-400">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-1.5 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {description && <p className="text-sm text-slate-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ companyName }: { companyName: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">You&apos;re in the queue</h1>
          <p className="text-slate-500 mt-2 leading-relaxed">
            Thanks, {companyName}. We&apos;ve received your intake form and we&apos;ll be in touch within 24 hours to get your SEO program set up.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-left space-y-2">
          <p className="text-sm font-medium text-slate-700">What happens next</p>
          <ol className="space-y-2">
            {[
              "We review your intake and confirm your package",
              "You'll receive portal login credentials via email",
              "Your Month 1 audit kicks off within 1–2 business days",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-500">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── main form ────────────────────────────────────────────────────────────────

type FormState = {
  company_name: string;
  contact_name: string;
  contact_email: string;
  billing_email: string;
  site_url: string;
  additional_sites: string;
  cms: string;
  seo_plugin: string;
  page_builder: string;
  keywords: string;
  competitors: string;
  pivot_context: string;
  excluded_pages: string;
  brand_voice_links: string;
  claims_no_generate: string;
  content_approver: string;
  brand_guidelines_url: string;
  customer_questions: string;
  sales_questions: string;
  in_slack: boolean;
  report_day: string;
  approval_turnaround: string;
  package: PackageTier;
};

const INITIAL_FORM: FormState = {
  company_name: "",
  contact_name: "",
  contact_email: "",
  billing_email: "",
  site_url: "",
  additional_sites: "",
  cms: "",
  seo_plugin: "",
  page_builder: "",
  keywords: "",
  competitors: "",
  pivot_context: "",
  excluded_pages: "",
  brand_voice_links: "",
  claims_no_generate: "",
  content_approver: "",
  brand_guidelines_url: "",
  customer_questions: "",
  sales_questions: "",
  in_slack: false,
  report_day: "",
  approval_turnaround: "",
  package: "growth",
};

export default function IntakePage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Something went wrong (${res.status}). Please try again.`);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) return <SuccessScreen companyName={form.company_name} />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="text-sm font-semibold text-slate-800 tracking-tight">Something Inc.</div>
          <h1 className="text-xl font-semibold text-slate-900 mt-1">Client Intake</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tell us about your business and we&apos;ll set up your SEO program. Most clients hear back within 24 hours.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Business Info ── */}
          <SectionCard
            title="About Your Business"
            description="Basic contact and website details."
          >
            <Field label="Company Name" required>
              <input
                type="text"
                className={inputClass}
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
                placeholder="Acme Corp"
                required
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Name" required>
                <input
                  type="text"
                  className={inputClass}
                  value={form.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                  placeholder="Jane Smith"
                  required
                />
              </Field>
              <Field label="Contact Email" required>
                <input
                  type="email"
                  className={inputClass}
                  value={form.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                  placeholder="jane@example.com"
                  required
                />
              </Field>
            </div>

            <Field label="Billing Email" hint="If different from contact email — invoices and receipts go here.">
              <input
                type="email"
                className={inputClass}
                value={form.billing_email}
                onChange={(e) => set("billing_email", e.target.value)}
                placeholder="billing@example.com"
              />
            </Field>

            <Field label="Primary Website URL" required>
              <input
                type="text"
                className={inputClass}
                value={form.site_url}
                onChange={(e) => set("site_url", e.target.value)}
                placeholder="https://example.com"
                required
              />
            </Field>

            <Field
              label="Additional Sites"
              hint="Any other domains you want included in the program — comma-separated."
            >
              <input
                type="text"
                className={inputClass}
                value={form.additional_sites}
                onChange={(e) => set("additional_sites", e.target.value)}
                placeholder="https://blog.example.com, https://shop.example.com"
              />
            </Field>
          </SectionCard>

          {/* ── SEO Goals ── */}
          <SectionCard
            title="SEO Goals"
            description="Helps us build your keyword strategy and understand where you want to win."
          >
            <Field
              label="Target Keywords"
              hint="The keywords and phrases you want to rank for. Separate with commas. Think about what your ideal customer searches for."
              required
            >
              <textarea
                className={textareaClass}
                rows={4}
                value={form.keywords}
                onChange={(e) => set("keywords", e.target.value)}
                placeholder="commercial roofing contractor chicago, flat roof repair near me, industrial roofing services"
                required
              />
            </Field>

            <Field
              label="Top Competitors"
              hint="Companies competing for the same customers. URLs or names are fine. At least one."
              required
            >
              <textarea
                className={textareaClass}
                rows={3}
                value={form.competitors}
                onChange={(e) => set("competitors", e.target.value)}
                placeholder="competitor1.com, Competitor Two, https://competitor3.com"
                required
              />
            </Field>

            <Field
              label="Business Context"
              hint="What do you do, who do you serve, and what makes you different? Any recent pivots or major changes worth knowing about?"
            >
              <textarea
                className={textareaClass}
                rows={4}
                value={form.pivot_context}
                onChange={(e) => set("pivot_context", e.target.value)}
                placeholder="We're a B2B SaaS company focused on mid-market logistics companies. We recently pivoted from a per-seat model to usage-based pricing…"
              />
            </Field>
          </SectionCard>

          {/* ── Website Tech ── */}
          <SectionCard
            title="Your Website"
            description="Technical setup — helps us plan the right implementation approach."
          >
            <Field label="Website Platform / CMS" required>
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.cms}
                  onChange={(e) => set("cms", e.target.value)}
                  required
                >
                  <option value="" disabled>Select a platform…</option>
                  {CMS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="SEO Plugin" hint="WordPress sites only — skip if not applicable.">
                <div className="relative">
                  <select
                    className={selectClass}
                    value={form.seo_plugin}
                    onChange={(e) => set("seo_plugin", e.target.value)}
                  >
                    <option value="">Not applicable / unsure</option>
                    {SEO_PLUGIN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </Field>

              <Field label="Page Builder" hint="What was the site built with?">
                <div className="relative">
                  <select
                    className={selectClass}
                    value={form.page_builder}
                    onChange={(e) => set("page_builder", e.target.value)}
                  >
                    <option value="">Not sure</option>
                    {PAGE_BUILDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </Field>
            </div>

            <Field
              label="Pages to Never Modify"
              hint="URLs we should never touch — terms, legal pages, login pages, etc. One per line."
            >
              <textarea
                className={textareaClass}
                rows={3}
                value={form.excluded_pages}
                onChange={(e) => set("excluded_pages", e.target.value)}
                placeholder="https://example.com/terms&#10;https://example.com/privacy&#10;https://example.com/login"
              />
            </Field>
          </SectionCard>

          {/* ── Content & Brand ── */}
          <SectionCard
            title="Content & Brand"
            description="Helps us write in your voice and avoid anything that shouldn't be generated."
          >
            <Field
              label="Brand Voice Reference Links"
              hint="Links to content whose tone you like — your own best pages, blogs you admire, or competitor content. One per line with a label."
            >
              <textarea
                className={textareaClass}
                rows={4}
                value={form.brand_voice_links}
                onChange={(e) => set("brand_voice_links", e.target.value)}
                placeholder={"Our best page — https://example.com/services\nBlog we admire — https://otherbrand.com/blog"}
              />
            </Field>

            <Field
              label="What Questions Do Customers Ask Before Buying?"
              hint="Questions, objections, or concerns that come up in sales conversations. These drive FAQ content that ranks and converts."
            >
              <textarea
                className={textareaClass}
                rows={4}
                value={form.customer_questions}
                onChange={(e) => set("customer_questions", e.target.value)}
                placeholder="How long does installation take? Do you service my area? What's the warranty?"
              />
            </Field>

            <Field
              label="What Does Your Sales Team Hear Constantly?"
              hint="Recurring themes, misconceptions, or comparisons with competitors. The more detail, the better the content strategy."
            >
              <textarea
                className={textareaClass}
                rows={4}
                value={form.sales_questions}
                onChange={(e) => set("sales_questions", e.target.value)}
                placeholder="Prospects always ask how we compare to [Competitor]. They think we're more expensive but don't realize we include…"
              />
            </Field>

            <Field
              label="Claims We Should Never AI-Generate"
              hint="Specific statistics, certifications, awards, or claims that must come from you — not be generated. Stored as guardrails."
            >
              <textarea
                className={textareaClass}
                rows={3}
                value={form.claims_no_generate}
                onChange={(e) => set("claims_no_generate", e.target.value)}
                placeholder="Do not generate: specific revenue figures, award claims, exact case study results, compliance certifications"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Content Approver" hint="Who reviews and approves generated content before it goes live?">
                <input
                  type="text"
                  className={inputClass}
                  value={form.content_approver}
                  onChange={(e) => set("content_approver", e.target.value)}
                  placeholder="Sarah Johnson"
                />
              </Field>

              <Field label="Brand Guidelines URL" hint="Link to a brand doc, Figma file, or Google Doc — optional.">
                <input
                  type="text"
                  className={inputClass}
                  value={form.brand_guidelines_url}
                  onChange={(e) => set("brand_guidelines_url", e.target.value)}
                  placeholder="https://drive.google.com/…"
                />
              </Field>
            </div>
          </SectionCard>

          {/* ── Preferences ── */}
          <SectionCard
            title="Preferences"
            description="How and when you'd like to work with us."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Preferred Report Day" hint="Which day of the week should we send your weekly report?">
                <div className="relative">
                  <select
                    className={selectClass}
                    value={form.report_day}
                    onChange={(e) => set("report_day", e.target.value)}
                  >
                    <option value="">No preference</option>
                    {REPORT_DAY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </Field>

              <Field label="Content Approval Turnaround" hint="How quickly will you review and approve content?">
                <div className="relative">
                  <select
                    className={selectClass}
                    value={form.approval_turnaround}
                    onChange={(e) => set("approval_turnaround", e.target.value)}
                  >
                    <option value="">No preference</option>
                    {APPROVAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </Field>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.in_slack}
                onChange={(e) => set("in_slack", e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-indigo-600 shrink-0"
              />
              <div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                  We&apos;re in your Slack workspace
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Check this if the Something Inc. team already has access to your Slack.</p>
              </div>
            </label>
          </SectionCard>

          {/* ── Package ── */}
          <SectionCard
            title="Package"
            description="Select the plan you signed up for. If you're unsure, leave Growth selected."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PACKAGE_TIER_ORDER.map((tier) => {
                const pkg = PACKAGES[tier];
                const colors = PACKAGE_COLORS[tier];
                const selected = form.package === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => set("package", tier)}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${
                      selected
                        ? `${colors.border} ${colors.bg}`
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className={`w-2 h-2 rounded-full ${selected ? colors.dot : "bg-slate-300"}`} />
                      <span className={`text-sm font-semibold ${selected ? colors.label : "text-slate-600"}`}>
                        {PACKAGE_LABELS[tier]}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-500">
                      <div>
                        {pkg.articles_standard} articles/mo
                        {pkg.articles_longform > 0 ? ` + ${pkg.articles_longform} long-form` : ""}
                      </div>
                      <div>{pkg.faq_sections} FAQ section{pkg.faq_sections !== 1 ? "s" : ""}/mo</div>
                      <div>{pkg.content_refreshes} content refresh{pkg.content_refreshes !== 1 ? "es" : ""}/mo</div>
                      <div>
                        {pkg.pages_optimized > 0 ? `${pkg.pages_optimized} pages optimized/mo` : "Refresh rotation"}
                      </div>
                      <div>{pkg.internal_links} internal links/mo</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ── Submit ── */}
          <div className="pb-8">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? "Submitting…" : "Submit Intake Form"}
            </button>
            <p className="text-xs text-slate-400 mt-2.5">
              Fields marked <span className="text-red-400">*</span> are required. Everything else helps us do better work but can be added later.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}
