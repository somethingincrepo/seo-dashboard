"use client";

import { useState, useEffect, useCallback } from "react";
import { PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";

const DRAFT_KEY = "intake_draft_v1";

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">You&apos;re all set, {companyName}.</h1>
            <p className="text-slate-500 mt-2 leading-relaxed">
              We&apos;ve received your onboarding form and everything is recorded. Your SEO program is officially underway.
            </p>
          </div>
        </div>

        {/* Email callout */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex gap-4">
          <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-indigo-800">Check your inbox</p>
            <p className="text-sm text-indigo-600 mt-0.5 leading-relaxed">
              You&apos;ll receive an email with your client portal link and login credentials shortly. The portal is where you&apos;ll review and approve all deliverables each month.
            </p>
          </div>
        </div>

        {/* What happens next */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-800">What&apos;s happening right now</p>
          <ol className="space-y-3">
            {[
              {
                title: "Site audit is running",
                desc: "We've kicked off a full audit of your site — crawling pages, analysing keywords, and identifying quick wins.",
              },
              {
                title: "Portal credentials coming your way",
                desc: "Your login link will arrive by email. Use it to review audit findings, approve changes, and track progress.",
              },
              {
                title: "First deliverables within the week",
                desc: "Title proposals, on-page recommendations, and internal link suggestions will appear in your portal once the audit wraps up.",
              },
              {
                title: "Monthly reports on your schedule",
                desc: "On the report day you selected, you'll automatically receive a full performance report covering rankings, traffic, and completed work.",
              },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-700">{step.title}</p>
                  <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-center text-xs text-slate-400">
          Questions? Reply to your confirmation email or reach out directly.
        </p>
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
  logo_url: string;
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
  logo_url: "",
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
  const [draftRestored, setDraftRestored] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // ── Invite token ──
  const [inviteToken, setInviteToken] = useState("");
  const [tokenStatus, setTokenStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [tokenReason, setTokenReason] = useState<"not_found" | "expired" | "used" | null>(null);

  // Compute the active draft key — token-scoped once a valid token is entered
  const activeDraftKey =
    tokenStatus === "valid"
      ? `intake_draft_${inviteToken.trim().toUpperCase()}`
      : DRAFT_KEY;

  // On mount — check for a saved generic draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormState>;
        if (parsed.company_name || parsed.contact_email || parsed.site_url) {
          setHasDraft(true);
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  // When token becomes valid, auto-restore the token-scoped draft if one exists
  useEffect(() => {
    if (tokenStatus !== "valid") return;
    const key = `intake_draft_${inviteToken.trim().toUpperCase()}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormState>;
        if (parsed.company_name || parsed.contact_email || parsed.site_url) {
          setForm((prev) => ({ ...prev, ...parsed }));
          setDraftRestored(true);
          setHasDraft(false);
        }
      }
    } catch {
      // ignore
    }
  }, [tokenStatus, inviteToken]);

  // Auto-save draft on every form change (uses active key from closure)
  const saveDraft = useCallback((state: FormState, draftKey: string) => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(state));
    } catch {
      // storage full or unavailable — non-fatal
    }
  }, []);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      saveDraft(next, activeDraftKey);
      return next;
    });

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(activeDraftKey);
      if (saved) {
        setForm({ ...INITIAL_FORM, ...(JSON.parse(saved) as Partial<FormState>) });
        setDraftRestored(true);
        setHasDraft(false);
      }
    } catch {
      setHasDraft(false);
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(activeDraftKey);
    setHasDraft(false);
  };

  const clearDraftOnSuccess = (draftKey: string) => {
    localStorage.removeItem(draftKey);
  };

  // Token validation
  const validateToken = useCallback(async (raw: string) => {
    const t = raw.trim().toUpperCase();
    if (!t) {
      setTokenStatus("idle");
      setTokenReason(null);
      return;
    }
    setTokenStatus("validating");
    setTokenReason(null);
    try {
      const res = await fetch(`/api/tokens/validate?token=${encodeURIComponent(t)}`);
      const data = await res.json() as { valid: boolean; package_tier?: string; reason?: string };
      if (data.valid && data.package_tier) {
        setTokenStatus("valid");
        setTokenReason(null);
        setForm((prev) => {
          const next = { ...prev, package: data.package_tier as PackageTier };
          return next;
        });
      } else {
        setTokenStatus("invalid");
        setTokenReason((data.reason as "not_found" | "expired" | "used") ?? "not_found");
      }
    } catch {
      setTokenStatus("invalid");
      setTokenReason("not_found");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (tokenStatus !== "valid") {
      setError("Please enter a valid invite token to continue.");
      return;
    }

    setSubmitting(true);
    setError(null);

    // Capture draft key before clearing — state won't change during await
    const draftKey = activeDraftKey;

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, invite_token: inviteToken.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Something went wrong (${res.status}). Please try again.`);
        return;
      }

      clearDraftOnSuccess(draftKey);
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

      {/* Draft banners */}
      {hasDraft && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-800">
              You have an unfinished form saved from a previous visit.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={restoreDraft}
                className="text-sm font-medium text-amber-900 underline underline-offset-2 hover:no-underline"
              >
                Resume
              </button>
              <span className="text-amber-300">·</span>
              <button
                type="button"
                onClick={discardDraft}
                className="text-sm text-amber-700 hover:text-amber-900"
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}
      {draftRestored && (
        <div className="bg-indigo-50 border-b border-indigo-200">
          <div className="max-w-2xl mx-auto px-4 py-2.5">
            <p className="text-sm text-indigo-700">Draft restored — pick up where you left off.</p>
          </div>
        </div>
      )}

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
              label="Logo URL"
              hint="A direct link to your logo (PNG, SVG, or WebP). If left blank, we'll use your site's favicon automatically."
            >
              <input
                type="text"
                className={inputClass}
                value={form.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </Field>

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

          {/* ── Invite Token ── */}
          <SectionCard
            title="Invite Token"
            description="Enter the token we sent you. This verifies your package and unlocks the form."
          >
            <Field label="Invite Token" required>
              <div className="space-y-2">
                <input
                  type="text"
                  className={`${inputClass} font-mono uppercase tracking-widest`}
                  value={inviteToken}
                  onChange={(e) => {
                    setInviteToken(e.target.value);
                    setTokenStatus("idle");
                    setTokenReason(null);
                  }}
                  onBlur={() => validateToken(inviteToken)}
                  placeholder="e.g. GRW-A7X3P9"
                  autoComplete="off"
                  spellCheck={false}
                />
                {tokenStatus === "validating" && (
                  <p className="text-xs text-slate-400">Checking token…</p>
                )}
                {tokenStatus === "valid" && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Token verified — {PACKAGE_LABELS[form.package]} package confirmed.
                  </p>
                )}
                {tokenStatus === "invalid" && (
                  <p className="text-xs text-red-500">
                    {tokenReason === "used"
                      ? "This token has already been used."
                      : tokenReason === "expired"
                      ? "This token has expired. Please contact us for a new one."
                      : "Token not recognised. Check for typos or contact us."}
                  </p>
                )}
              </div>
            </Field>
          </SectionCard>

          {/* ── Package ── */}
          <SectionCard
            title="Package"
            description={
              tokenStatus === "valid"
                ? "Package locked by your invite token."
                : "Select the plan you signed up for. If you're unsure, leave Growth selected."
            }
          >
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${tokenStatus === "valid" ? "pointer-events-none opacity-80" : ""}`}>
              {PACKAGE_TIER_ORDER.map((tier) => {
                const pkg = PACKAGES[tier];
                const colors = PACKAGE_COLORS[tier];
                const selected = form.package === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => tokenStatus !== "valid" && set("package", tier)}
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
                      {tokenStatus === "valid" && selected && (
                        <span className="ml-auto text-xs font-medium text-emerald-600">Verified</span>
                      )}
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
