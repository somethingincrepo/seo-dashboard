"use client";

import { useState, useEffect, useCallback } from "react";
import { PACKAGES, PACKAGE_LABELS, type PackageTier } from "@/lib/packages";

const DRAFT_KEY = "intake_draft_v1";

const PACKAGE_TIER_ORDER: PackageTier[] = ["starter", "growth", "authority"];

const PACKAGE_COLORS: Record<PackageTier, { border: string; bg: string; label: string; dot: string }> = {
  starter:   { border: "border-slate-300",  bg: "bg-slate-50",  label: "text-slate-700",  dot: "bg-slate-400"  },
  growth:    { border: "border-indigo-500", bg: "bg-indigo-50", label: "text-indigo-700", dot: "bg-indigo-500" },
  authority: { border: "border-violet-500", bg: "bg-violet-50", label: "text-violet-700", dot: "bg-violet-500" },
};

const CMS_OPTIONS = ["WordPress", "Shopify", "Webflow", "HubSpot", "Squarespace", "Wix", "Framer", "Custom / Other"];
const SEO_PLUGIN_OPTIONS = ["Yoast", "RankMath", "AIOSEO", "None", "Other"];
const PAGE_BUILDER_OPTIONS = ["Elementor", "Divi", "Gutenberg", "Beaver Builder", "Webflow Native", "None", "Other"];
const REPORT_DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const APPROVAL_OPTIONS = ["24 hours", "48 hours", "1 week"];

const inputClass =
  "w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white placeholder:text-slate-400 transition-all";

const textareaClass =
  "w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white placeholder:text-slate-400 resize-none transition-all";

const selectClass =
  "w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white transition-all appearance-none";

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-1.5 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {description && <p className="text-sm text-slate-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Success screen ──────────────────────────────────────────────────────────

type PortalCredentials = {
  username: string;
  password: string;
  portal_url: string;
};

function CopyInline({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function SuccessScreen({ companyName, creds }: { companyName: string; creds: PortalCredentials | null }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">You&apos;re all set, {companyName}.</h1>
            <p className="text-slate-500 mt-2 leading-relaxed">
              Your SEO program is officially underway. Save your portal login details below.
            </p>
          </div>
        </div>

        {creds && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm font-semibold text-amber-800">Copy your login details now — you won&apos;t see the password again.</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 border border-amber-200">
                <span className="text-slate-500 text-xs w-16 shrink-0">Login URL</span>
                <span className="font-mono text-indigo-700 flex-1 truncate">{creds.portal_url}/login</span>
                <CopyInline value={`${creds.portal_url}/login`} />
              </div>
              <div className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 border border-amber-200">
                <span className="text-slate-500 text-xs w-16 shrink-0">Username</span>
                <span className="font-mono text-slate-800 flex-1">{creds.username}</span>
                <CopyInline value={creds.username} />
              </div>
              <div className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 border border-amber-200">
                <span className="text-slate-500 text-xs w-16 shrink-0">Password</span>
                <span className="font-mono text-slate-800 flex-1">{creds.password}</span>
                <CopyInline value={creds.password} />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-800">What happens next</p>
          <ol className="space-y-3">
            {[
              { title: "Site audit is running", desc: "Full crawl, keyword mapping, and quick-win identification." },
              { title: "Log in to your portal", desc: "Use the credentials above to review audit findings, approve changes, and track progress." },
              { title: "First deliverables within the week", desc: "Title proposals, on-page recommendations, and internal link suggestions." },
              { title: "Monthly reports on your schedule", desc: "Rankings, traffic, and completed work — automatically on your chosen day." },
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
      </div>
    </div>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────

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
  is_local_business: boolean;
  service_areas: string;
};

const INITIAL_FORM: FormState = {
  company_name: "", contact_name: "", contact_email: "", billing_email: "",
  site_url: "", additional_sites: "", cms: "", seo_plugin: "", page_builder: "",
  keywords: "", competitors: "", pivot_context: "", excluded_pages: "",
  logo_url: "", brand_voice_links: "", claims_no_generate: "", content_approver: "",
  brand_guidelines_url: "", customer_questions: "", sales_questions: "",
  in_slack: false, report_day: "", approval_turnaround: "", package: "growth",
  is_local_business: false, service_areas: "",
};

// ── Brand panel (shared between steps) ──────────────────────────────────────

const BRAND_FEATURES = [
  "Full site audit in month one",
  "Articles, links, and tech fixes automated",
  "Every change approved before it ships",
  "Live client portal with real-time progress",
  "Reddit monitoring and AI search structuring",
];

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex w-[46%] relative overflow-hidden shrink-0"
      style={{ background: "linear-gradient(145deg, #0b1f33 0%, #0c2b40 50%, #0a3d2a 100%)" }}
    >
      <div className="absolute top-1/4 right-1/4 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(110,230,243,0.16) 0%, transparent 70%)" }} />
      <div className="absolute bottom-1/3 left-1/5 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(181,232,74,0.12) 0%, transparent 70%)" }} />

      <div className="relative z-10 flex flex-col justify-center px-12 py-16 w-full">
        <div className="text-xs font-semibold tracking-widest uppercase mb-5" style={{ color: "#6ee6f3" }}>
          Guru · SEO Automation
        </div>
        <h2 className="text-[1.9rem] font-semibold text-white leading-tight mb-3">
          Your SEO operation,{" "}
          <span className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #6ee6f3, #b5e84a)" }}>
            on autopilot.
          </span>
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-10 max-w-[280px]">
          Everything an expensive SEO agency does — automated, with your approval on every change before it touches your site.
        </p>

        <div className="space-y-3 mb-10">
          {BRAND_FEATURES.map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(74,222,128,0.15)" }}>
                <svg viewBox="0 0 10 10" fill="none" width="8" height="8">
                  <path d="M2 5l2 2 4-4" stroke="#4ade80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-sm text-slate-300">{item}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-xs text-slate-400 mb-3 font-semibold tracking-wide uppercase">Example sprint</div>
          <div className="space-y-2">
            {[
              { label: "Articles shipped", val: "8 / 14", c: "#4ade80" },
              { label: "Approvals pending", val: "3", c: "#fbbf24" },
              { label: "Links implemented", val: "106", c: "#38bdf8" },
            ].map(({ label, val, c }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{label}</span>
                <span className="text-sm font-semibold tabular" style={{ color: c }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [portalCreds, setPortalCreds] = useState<PortalCredentials | null>(null);

  // Token state
  const [inviteToken, setInviteToken] = useState("");
  const [tokenStatus, setTokenStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [tokenReason, setTokenReason] = useState<"not_found" | "expired" | "used" | null>(null);

  // Draft
  const [hasDraft, setHasDraft] = useState(false);
  const activeDraftKey = tokenStatus === "valid"
    ? `intake_draft_${inviteToken.trim().toUpperCase()}`
    : DRAFT_KEY;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const p = JSON.parse(saved) as Partial<FormState>;
        if (p.company_name || p.contact_email || p.site_url) setHasDraft(true);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tokenStatus !== "valid") return;
    const key = `intake_draft_${inviteToken.trim().toUpperCase()}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const p = JSON.parse(saved) as Partial<FormState>;
        if (p.company_name || p.contact_email) {
          setForm((prev) => ({ ...prev, ...p }));
          setHasDraft(false);
        }
      }
    } catch { /* ignore */ }
  }, [tokenStatus, inviteToken]);

  const saveDraft = useCallback((state: FormState, draftKey: string) => {
    try { localStorage.setItem(draftKey, JSON.stringify(state)); } catch { /* ignore */ }
  }, []);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      saveDraft(next, activeDraftKey);
      return next;
    });

  const validateToken = useCallback(async (raw: string) => {
    const t = raw.trim().toUpperCase();
    if (!t) { setTokenStatus("idle"); setTokenReason(null); return; }
    setTokenStatus("validating");
    try {
      const res = await fetch(`/api/tokens/validate?token=${encodeURIComponent(t)}`);
      const data = await res.json() as { valid: boolean; package_tier?: string; reason?: string };
      if (data.valid && data.package_tier) {
        setTokenStatus("valid");
        setTokenReason(null);
        setForm((prev) => ({ ...prev, package: data.package_tier as PackageTier }));
      } else {
        setTokenStatus("invalid");
        setTokenReason((data.reason as typeof tokenReason) ?? "not_found");
      }
    } catch {
      setTokenStatus("invalid");
      setTokenReason("not_found");
    }
  }, []);

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenStatus !== "valid") {
      setError("Please enter a valid invite token to continue.");
      return;
    }
    setError(null);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const draftKey = activeDraftKey;
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, invite_token: inviteToken.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || `Something went wrong (${res.status}).`); return; }
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      if (data.portal_username && data.portal_password && data.portal_url) {
        setPortalCreds({ username: data.portal_username, password: data.portal_password, portal_url: data.portal_url });
      }
      setSuccess(true);
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) return <SuccessScreen companyName={form.company_name} creds={portalCreds} />;

  // ── Step 1: Sign-up gate ──────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen flex bg-slate-50">
        {/* Form side */}
        <div className="w-full lg:w-[54%] flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12">
          <div className="max-w-md w-full mx-auto">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-10">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow"
                style={{ background: "linear-gradient(135deg, #b5e84a, #1eaecb)" }}>
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                  <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-slate-900 tracking-tight">Guru</span>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Get started</h1>
              <p className="text-slate-500 text-sm mt-1">
                Tell us the basics and we&apos;ll set up your account. Full onboarding takes about 5 minutes.
              </p>
            </div>

            {/* Draft banner */}
            {hasDraft && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <p className="text-sm text-amber-800">You have a saved draft.</p>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const saved = localStorage.getItem(DRAFT_KEY);
                      if (saved) setForm({ ...INITIAL_FORM, ...(JSON.parse(saved) as Partial<FormState>) });
                      setHasDraft(false);
                    } catch { setHasDraft(false); }
                  }}
                  className="text-sm font-medium text-amber-900 underline underline-offset-2 hover:no-underline shrink-0"
                >
                  Resume
                </button>
              </div>
            )}

            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Your name" required>
                  <input type="text" className={inputClass} value={form.contact_name}
                    onChange={(e) => set("contact_name", e.target.value)}
                    placeholder="Jane Smith" required autoFocus />
                </Field>
                <Field label="Company name" required>
                  <input type="text" className={inputClass} value={form.company_name}
                    onChange={(e) => set("company_name", e.target.value)}
                    placeholder="Acme Corp" required />
                </Field>
              </div>

              <Field label="Work email" required>
                <input type="email" className={inputClass} value={form.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                  placeholder="jane@example.com" required />
              </Field>

              <Field label="Website URL" required>
                <input type="text" className={inputClass} value={form.site_url}
                  onChange={(e) => set("site_url", e.target.value)}
                  placeholder="https://example.com" required />
              </Field>

              {/* Invite token */}
              <Field label="Invite token" hint="The token we sent you. This confirms your package." required>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    className={`${inputClass} font-mono uppercase tracking-widest`}
                    value={inviteToken}
                    onChange={(e) => { setInviteToken(e.target.value); setTokenStatus("idle"); setTokenReason(null); }}
                    onBlur={() => validateToken(inviteToken)}
                    placeholder="e.g. GRW-A7X3P9"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {tokenStatus === "validating" && (
                    <p className="text-xs text-slate-400">Checking token…</p>
                  )}
                  {tokenStatus === "valid" && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-xs text-emerald-600 font-medium">
                        Token verified — {PACKAGE_LABELS[form.package]} plan confirmed.
                      </p>
                    </div>
                  )}
                  {tokenStatus === "invalid" && (
                    <p className="text-xs text-red-500">
                      {tokenReason === "used" ? "This token has already been used."
                        : tokenReason === "expired" ? "This token has expired. Please contact us for a new one."
                        : "Token not recognised. Check for typos or contact us."}
                    </p>
                  )}
                </div>
              </Field>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-sm cursor-pointer mt-2"
              >
                Continue to onboarding →
              </button>

              <p className="text-center text-sm text-slate-400">
                Already have an account?{" "}
                <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
                  Sign in
                </a>
              </p>
            </form>
          </div>
        </div>

        <BrandPanel />
      </div>
    );
  }

  // ── Step 2: Full onboarding ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #b5e84a, #1eaecb)" }}>
              <svg viewBox="0 0 20 20" fill="none" width="12" height="12">
                <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Guru Onboarding</div>
              <div className="text-xs text-slate-400">{form.company_name || "Your business"} · {PACKAGE_LABELS[form.package]} plan</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-200" />
            <div className="w-8 h-2 rounded-full bg-indigo-500" />
            <span className="text-xs text-slate-400 ml-1">Step 2 of 2</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Tell us about your business</h1>
          <p className="text-sm text-slate-500 mt-1">
            This helps us build your keyword strategy, understand your site, and write in your voice. Most fields can be updated later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* SEO Goals */}
          <SectionCard title="SEO Goals" description="Keyword strategy and competitive context.">
            <Field label="Target keywords" hint="What your ideal customer searches for. Separate with commas." required>
              <textarea className={textareaClass} rows={4} value={form.keywords}
                onChange={(e) => set("keywords", e.target.value)}
                placeholder="best project management software, task tracker for teams, team collaboration tool"
                required />
            </Field>
            <Field label="Top competitors" hint="Companies competing for the same customers — URLs or names." required>
              <textarea className={textareaClass} rows={3} value={form.competitors}
                onChange={(e) => set("competitors", e.target.value)}
                placeholder="competitorone.com, Competitor Two, https://competitorthree.com"
                required />
            </Field>
            <Field label="Business context" hint="What you do, who you serve, and what makes you different.">
              <textarea className={textareaClass} rows={4} value={form.pivot_context}
                onChange={(e) => set("pivot_context", e.target.value)}
                placeholder="We help [type of customer] do [outcome]. Our main differentiator is…" />
            </Field>
          </SectionCard>

          {/* Service area */}
          <SectionCard title="Service Area" description="Only fill in if you serve specific locations.">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={form.is_local_business}
                onChange={(e) => set("is_local_business", e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-indigo-600 shrink-0" />
              <div>
                <span className="text-sm font-medium text-slate-700">We only serve specific geographic areas</span>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Check this if your customers are mostly in specific cities or regions.
                </p>
              </div>
            </label>
            {form.is_local_business && (
              <Field label="Cities / regions you serve" hint="Comma-separated. Used in geo-targeted titles." required>
                <input type="text" className={inputClass} value={form.service_areas}
                  onChange={(e) => set("service_areas", e.target.value)}
                  placeholder="New York, Boston, Philadelphia" required />
              </Field>
            )}
          </SectionCard>

          {/* Website tech */}
          <SectionCard title="Your Website" description="Technical setup — helps us plan the right implementation approach.">
            <Field label="Platform / CMS" required>
              <div className="relative">
                <select className={selectClass} value={form.cms}
                  onChange={(e) => set("cms", e.target.value)} required>
                  <option value="" disabled>Select a platform…</option>
                  {CMS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </Field>
            {form.cms === "WordPress" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="SEO plugin">
                  <div className="relative">
                    <select className={selectClass} value={form.seo_plugin} onChange={(e) => set("seo_plugin", e.target.value)}>
                      <option value="">Not sure</option>
                      {SEO_PLUGIN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </Field>
                <Field label="Page builder">
                  <div className="relative">
                    <select className={selectClass} value={form.page_builder} onChange={(e) => set("page_builder", e.target.value)}>
                      <option value="">Not sure</option>
                      {PAGE_BUILDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </Field>
              </div>
            )}
            <Field label="Pages to never modify" hint="URLs we should never touch — legal, login, etc. One per line.">
              <textarea className={textareaClass} rows={3} value={form.excluded_pages}
                onChange={(e) => set("excluded_pages", e.target.value)}
                placeholder={"https://example.com/terms\nhttps://example.com/privacy"} />
            </Field>
            <Field label="Additional billing email" hint="If different from your contact email.">
              <input type="email" className={inputClass} value={form.billing_email}
                onChange={(e) => set("billing_email", e.target.value)}
                placeholder="billing@example.com" />
            </Field>
            <Field label="Additional sites" hint="Other domains to include — comma-separated.">
              <input type="text" className={inputClass} value={form.additional_sites}
                onChange={(e) => set("additional_sites", e.target.value)}
                placeholder="https://blog.example.com, https://shop.example.com" />
            </Field>
          </SectionCard>

          {/* Content & brand */}
          <SectionCard title="Content & Brand" description="Helps us write in your voice.">
            <Field label="Brand voice reference links" hint="Links to content whose tone you like — your best pages or admired blogs.">
              <textarea className={textareaClass} rows={3} value={form.brand_voice_links}
                onChange={(e) => set("brand_voice_links", e.target.value)}
                placeholder={"Our best page — https://example.com/services\nBlog we admire — https://otherbrand.com/blog"} />
            </Field>
            <Field label="Questions customers ask before buying" hint="FAQ content that ranks and converts.">
              <textarea className={textareaClass} rows={4} value={form.customer_questions}
                onChange={(e) => set("customer_questions", e.target.value)}
                placeholder="How long does installation take? Do you service my area?" />
            </Field>
            <Field label="What your sales team hears constantly" hint="Recurring themes, misconceptions, competitor comparisons.">
              <textarea className={textareaClass} rows={3} value={form.sales_questions}
                onChange={(e) => set("sales_questions", e.target.value)}
                placeholder="We hear a lot about how we compare to [Competitor], and questions about pricing/contracts…" />
            </Field>
            <Field label="Claims we should never generate" hint="Specific stats, certifications, or awards that must come from you.">
              <textarea className={textareaClass} rows={3} value={form.claims_no_generate}
                onChange={(e) => set("claims_no_generate", e.target.value)}
                placeholder="Do not claim specific certifications, awards, or statistics we haven't verified" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Content approver" hint="Who reviews and approves content?">
                <input type="text" className={inputClass} value={form.content_approver}
                  onChange={(e) => set("content_approver", e.target.value)}
                  placeholder="Sarah Johnson" />
              </Field>
              <Field label="Brand guidelines URL">
                <input type="text" className={inputClass} value={form.brand_guidelines_url}
                  onChange={(e) => set("brand_guidelines_url", e.target.value)}
                  placeholder="https://drive.google.com/…" />
              </Field>
            </div>
            <Field label="Logo URL" hint="Direct link to your logo (PNG, SVG, WebP). Leave blank to use your favicon.">
              <input type="text" className={inputClass} value={form.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://example.com/logo.png" />
            </Field>
          </SectionCard>

          {/* Preferences */}
          <SectionCard title="Preferences" description="How and when you'd like to work with us.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Preferred report day">
                <div className="relative">
                  <select className={selectClass} value={form.report_day} onChange={(e) => set("report_day", e.target.value)}>
                    <option value="">No preference</option>
                    {REPORT_DAY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </Field>
              <Field label="Content approval turnaround">
                <div className="relative">
                  <select className={selectClass} value={form.approval_turnaround} onChange={(e) => set("approval_turnaround", e.target.value)}>
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
              <input type="checkbox" checked={form.in_slack}
                onChange={(e) => set("in_slack", e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-indigo-600 shrink-0" />
              <div>
                <span className="text-sm font-medium text-slate-700">The Guru team is in our Slack workspace</span>
                <p className="text-xs text-slate-400 mt-0.5">Check if we already have Slack access.</p>
              </div>
            </label>
          </SectionCard>

          {/* Package */}
          <SectionCard
            title="Plan"
            description={tokenStatus === "valid" ? "Locked by your invite token." : "Select the plan you signed up for."}
          >
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${tokenStatus === "valid" ? "pointer-events-none opacity-75" : ""}`}>
              {PACKAGE_TIER_ORDER.map((tier) => {
                const pkg = PACKAGES[tier];
                const colors = PACKAGE_COLORS[tier];
                const selected = form.package === tier;
                return (
                  <button key={tier} type="button"
                    onClick={() => tokenStatus !== "valid" && set("package", tier)}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${selected ? `${colors.border} ${colors.bg}` : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className={`w-2 h-2 rounded-full ${selected ? colors.dot : "bg-slate-300"}`} />
                      <span className={`text-sm font-semibold ${selected ? colors.label : "text-slate-600"}`}>
                        {PACKAGE_LABELS[tier]}
                      </span>
                      {tokenStatus === "valid" && selected && (
                        <span className="ml-auto text-xs font-medium text-emerald-600">✓ Verified</span>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-slate-500">
                      <div>{pkg.articles_standard} articles/mo{pkg.articles_longform > 0 ? ` + ${pkg.articles_longform} long-form` : ""}</div>
                      <div>{pkg.faq_sections} FAQ section{pkg.faq_sections !== 1 ? "s" : ""}/mo</div>
                      <div>{pkg.content_refreshes} refresh{pkg.content_refreshes !== 1 ? "es" : ""}/mo</div>
                      <div>{pkg.internal_links} internal links/mo</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="pb-8 flex items-center gap-4">
            <button type="button" onClick={() => setStep(1)}
              className="px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:border-slate-300 transition-all">
              ← Back
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 sm:flex-none px-8 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
              {submitting ? "Submitting…" : "Complete onboarding →"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
