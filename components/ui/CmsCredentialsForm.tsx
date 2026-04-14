"use client";
import { useState } from "react";

interface CmsCredentialsFormProps {
  clientId: string; // Airtable record ID
  siteUrl: string;
  initialValues: {
    wp_username: string;
    wp_app_password: string;
    seo_plugin: string;
    page_builder: string;
  };
}

type TestResult =
  | { ok: true; wp_user: string; roles: string[] }
  | { ok: false; error: string };

export function CmsCredentialsForm({
  clientId,
  siteUrl,
  initialValues,
}: CmsCredentialsFormProps) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  function set(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setSaved(false);
    setTestResult(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/cms-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/test-wp-connection`, {
        method: "POST",
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "Network error" });
    } finally {
      setTesting(false);
    }
  }

  const hasCredentials = !!(values.wp_username && values.wp_app_password);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* wp_username */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">WP Username</label>
          <input
            type="text"
            value={values.wp_username}
            onChange={(e) => set("wp_username", e.target.value)}
            placeholder="admin"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* wp_app_password */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            Application Password
            <span className="text-slate-400 ml-1 font-normal">(WP Admin → Users → Edit → Application Passwords)</span>
          </label>
          <input
            type="password"
            value={values.wp_app_password}
            onChange={(e) => set("wp_app_password", e.target.value)}
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* seo_plugin */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">SEO Plugin</label>
          <select
            value={values.seo_plugin}
            onChange={(e) => set("seo_plugin", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">— unknown —</option>
            <option value="yoast">Yoast SEO</option>
            <option value="rankmath">RankMath</option>
            <option value="aioseo">AIOSEO</option>
          </select>
        </div>

        {/* page_builder */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Page Builder</label>
          <select
            value={values.page_builder}
            onChange={(e) => set("page_builder", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">Gutenberg (default)</option>
            <option value="Elementor">Elementor</option>
            <option value="Divi">Divi</option>
            <option value="Beaver Builder">Beaver Builder</option>
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm border transition-all disabled:opacity-40 bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save credentials"}
        </button>

        {hasCredentials && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 rounded-xl text-sm border transition-all disabled:opacity-40 bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
        )}

        {siteUrl && (
          <a
            href={`${siteUrl.replace(/\/$/, "")}/wp-admin/profile.php#application-passwords-section`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Open WP Admin → Application Passwords ↗
          </a>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            testResult.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {testResult.ok ? (
            <>
              <span className="font-medium">Connected</span> — logged in as{" "}
              <span className="font-mono">{testResult.wp_user}</span>{" "}
              {testResult.roles.length > 0 && (
                <span className="text-emerald-500">({testResult.roles.join(", ")})</span>
              )}
            </>
          ) : (
            <>
              <span className="font-medium">Connection failed</span> — {testResult.error}
            </>
          )}
        </div>
      )}
    </div>
  );
}
