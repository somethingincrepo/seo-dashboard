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

const DEFAULT_NAV_PAGES = [
  "https://tidaltreasureschartersbvi.com/",
  "https://tidaltreasureschartersbvi.com/full-day-charters/",
  "https://tidaltreasureschartersbvi.com/half-day-charters/",
  "https://tidaltreasureschartersbvi.com/sunset-dinner-charters/",
  "https://tidaltreasureschartersbvi.com/water-taxi/",
  "https://tidaltreasureschartersbvi.com/charters/",
  "https://tidaltreasureschartersbvi.com/about-us/",
  "https://tidaltreasureschartersbvi.com/request-booking/",
  "https://tidaltreasureschartersbvi.com/contact/",
  "https://tidaltreasureschartersbvi.com/testimonials/",
  "https://tidaltreasureschartersbvi.com/gallery/",
  "https://tidaltreasureschartersbvi.com/blog/",
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
    company_name: "Tidal Treasures Charters & Water Taxi",
    contact_name: "",
    contact_email: "",
    site_url: "https://tidaltreasureschartersbvi.com/",
    domain: "tidaltreasureschartersbvi.com",
    cms: "WordPress",
    gsc_property: "sc-domain:tidaltreasureschartersbvi.com",
    nav_pages: DEFAULT_NAV_PAGES.join("\n"),
    keywords: "BVI boat charters, British Virgin Islands water taxi, Tortola charter, private charter BVI, sunset charters Tortola",
    competitors: "",
    notes: "Charter and water taxi service based in Tortola, BVI. WordPress/Elementor site.",
    run_audit: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ record_id: string; client_id: string; job_id: string | null } | null>(null);

  const handleChange = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
    return (
      <div className="max-w-xl space-y-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <div className="text-emerald-700 font-semibold text-lg mb-2">Client created</div>
          <div className="text-sm text-slate-600 space-y-1">
            <div><span className="text-slate-400">Record ID:</span> <span className="font-mono">{result.record_id}</span></div>
            <div><span className="text-slate-400">Client slug:</span> <span className="font-mono">{result.client_id}</span></div>
            {result.job_id ? (
              <div><span className="text-slate-400">Audit job:</span>{" "}
                <Link href={`/jobs/${result.job_id}`} className="font-mono text-indigo-600 hover:underline">
                  {result.job_id}
                </Link>
              </div>
            ) : (
              <div className="text-amber-600 text-xs mt-2">No audit job triggered (run_audit was off)</div>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Link
              href="/jobs"
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-colors"
            >
              View Jobs →
            </Link>
            <Link
              href="/clients"
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-xl hover:bg-slate-200 transition-colors"
            >
              All Clients
            </Link>
          </div>
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
