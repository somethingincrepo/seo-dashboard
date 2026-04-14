"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CMS_OPTIONS = [
  "WordPress",
  "Shopify",
  "Webflow",
  "Squarespace",
  "Wix",
  "HubSpot CMS",
  "Framer",
  "Custom / Other",
];


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
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

const inputClass =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white placeholder:text-slate-300";

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    contact_email: "",
    site_url: "",
    domain: "",
    cms: "WordPress",
    gsc_property: "",
    nav_pages: "",
    keywords: "",
    competitors: "",
    notes: "",
    run_audit: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    record_id: string;
    client_id: string;
    job_id: string | null;
    portal_username?: string;
    portal_password?: string;
    portal_token?: string;
  } | null>(null);

  const handleChange = (key: string, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-derive domain and gsc_property when site_url changes
      if (key === "site_url" && typeof value === "string") {
        try {
          const domain = new URL(value).hostname.replace(/^www\./, "");
          if (domain) {
            if (!prev.domain || prev.domain === deriveField(prev.site_url, "domain")) {
              next.domain = domain;
            }
            if (!prev.gsc_property || prev.gsc_property === deriveField(prev.site_url, "gsc")) {
              next.gsc_property = `sc-domain:${domain}`;
            }
          }
        } catch {
          // invalid URL — leave fields alone
        }
      }
      return next;
    });
  };

  function deriveField(url: string, kind: "domain" | "gsc"): string {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      return kind === "domain" ? domain : `sc-domain:${domain}`;
    } catch {
      return "";
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const adminPassword = prompt("Enter admin password:");
    if (!adminPassword) {
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/clients/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminPassword}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const loginUrl = `${baseUrl}/portal/login`;

    function CopyBtn({ value }: { value: string }) {
      const [copied, setCopied] = useState(false);
      return (
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="px-2 py-0.5 rounded-lg text-xs border transition-all bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          {copied ? "✓" : "Copy"}
        </button>
      );
    }

    return (
      <div className="max-w-xl space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <div className="text-emerald-700 font-semibold text-lg mb-1">Client created</div>
          <div className="text-sm text-slate-500 mb-4">
            {result.job_id
              ? "Month 1 audit is running."
              : "No audit triggered — run_audit was off."}
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div>Record: <span className="font-mono text-slate-600">{result.record_id}</span></div>
            <div>Slug: <span className="font-mono text-slate-600">{result.client_id}</span></div>
            {result.job_id && (
              <div>Job:{" "}
                <Link href={`/jobs/${result.job_id}`} className="font-mono text-indigo-600 hover:underline">
                  {result.job_id}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Portal credentials — send these to the client */}
        {result.portal_username && (
          <div className="border border-slate-200 rounded-2xl p-6 space-y-3 bg-white">
            <div className="text-sm font-semibold text-slate-700">Portal Login Credentials</div>
            <p className="text-xs text-slate-400">Send these to the client. You can also find them anytime on the client detail page.</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-20 shrink-0">Username</span>
                <span className="font-mono text-sm text-slate-800 flex-1">{result.portal_username}</span>
                <CopyBtn value={result.portal_username} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-20 shrink-0">Password</span>
                <span className="font-mono text-sm text-slate-800 flex-1">{result.portal_password}</span>
                <CopyBtn value={result.portal_password!} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-20 shrink-0">Login URL</span>
                <span className="font-mono text-sm text-indigo-600 flex-1">{loginUrl}</span>
                <CopyBtn value={loginUrl} />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href={`/clients/${result.record_id}`}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-colors"
          >
            View Client →
          </Link>
          {result.job_id && (
            <Link
              href={`/jobs/${result.job_id}`}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-xl hover:bg-slate-200 transition-colors"
            >
              View Audit Job
            </Link>
          )}
          <Link
            href="/clients"
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-xl hover:bg-slate-200 transition-colors"
          >
            All Clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/clients" className="text-slate-500 text-sm hover:text-slate-600 transition-colors">
          ← Clients
        </Link>
        <h1 className="text-2xl font-semibold mt-2">New Client Onboarding</h1>
        <p className="text-slate-500 text-sm mt-1">Creates the Airtable record and optionally kicks off the Month 1 audit.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Company</h2>
          <Field label="Company Name" required>
            <input
              type="text"
              className={inputClass}
              value={form.company_name}
              onChange={(e) => handleChange("company_name", e.target.value)}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name">
              <input
                type="text"
                className={inputClass}
                value={form.contact_name}
                onChange={(e) => handleChange("contact_name", e.target.value)}
              />
            </Field>
            <Field label="Contact Email">
              <input
                type="email"
                className={inputClass}
                value={form.contact_email}
                onChange={(e) => handleChange("contact_email", e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* Site / Tech */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Site & Tech</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Site URL" required>
              <input
                type="url"
                className={inputClass}
                value={form.site_url}
                onChange={(e) => handleChange("site_url", e.target.value)}
                required
              />
            </Field>
            <Field label="Domain" hint="Root domain only (no https://)" required>
              <input
                type="text"
                className={inputClass}
                value={form.domain}
                onChange={(e) => handleChange("domain", e.target.value)}
                placeholder="example.com"
                required
              />
            </Field>
          </div>
          <Field label="CMS" required>
            <select
              className={inputClass}
              value={form.cms}
              onChange={(e) => handleChange("cms", e.target.value)}
              required
            >
              {CMS_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="GSC Property" hint="Google Search Console property (e.g. sc-domain:example.com)">
            <input
              type="text"
              className={inputClass}
              value={form.gsc_property}
              onChange={(e) => handleChange("gsc_property", e.target.value)}
              placeholder="sc-domain:example.com"
            />
          </Field>
        </div>

        {/* SEO context */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">SEO Context</h2>
          <Field
            label="Nav Pages"
            hint="One URL per line — these are the site's core navigational pages used by all audit SOPs"
            required
          >
            <textarea
              className={inputClass}
              rows={10}
              value={form.nav_pages}
              onChange={(e) => handleChange("nav_pages", e.target.value)}
              placeholder="https://example.com/&#10;https://example.com/about/"
              required
            />
          </Field>
          <Field label="Seed Keywords" hint="Comma-separated — used as starting context for keyword research">
            <textarea
              className={inputClass}
              rows={3}
              value={form.keywords}
              onChange={(e) => handleChange("keywords", e.target.value)}
            />
          </Field>
          <Field label="Competitors" hint="Comma-separated competitor domains">
            <input
              type="text"
              className={inputClass}
              value={form.competitors}
              onChange={(e) => handleChange("competitors", e.target.value)}
              placeholder="competitor1.com, competitor2.com"
            />
          </Field>
          <Field label="Notes">
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
            />
          </Field>
        </div>

        {/* Audit trigger */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.run_audit}
              onChange={(e) => handleChange("run_audit", e.target.checked)}
              className="w-4 h-4 accent-indigo-600"
            />
            <div>
              <div className="text-sm font-medium text-slate-800">Trigger Month 1 audit immediately</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Creates an audit_parent job on Fly.io. Requires nav_pages + GSC property to be populated.
              </div>
            </div>
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creating…" : "Create Client"}
          </button>
          <Link
            href="/clients"
            className="px-5 py-2.5 bg-slate-100 text-slate-700 text-sm rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
