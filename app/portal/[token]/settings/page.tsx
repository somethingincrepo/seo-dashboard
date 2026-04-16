"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const SEO_PLUGINS = ["Yoast", "RankMath", "AIOSEO", "SEOPress", "Other / None"];
const PAGE_BUILDERS = ["Gutenberg (Block Editor)", "Elementor", "Divi", "Beaver Builder", "Bricks", "Oxygen", "Other"];

type ClientData = {
  cms: string;
  site_url: string;
  wp_username: string;
  wp_app_password: string;
  seo_plugin: string;
  page_builder: string;
};

type TestResult = { ok: boolean; wp_user?: string; roles?: string[]; error?: string };
type Toast = { message: string; type: "success" | "error" };

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = (message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  return { toast, show };
}

// Instructions for each CMS type
function WpHelpPanel() {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4 text-[13px]">
      <div>
        <p className="font-semibold text-slate-800 mb-1">Finding your WordPress username</p>
        <ol className="space-y-1 text-slate-600 list-decimal list-inside">
          <li>Log in to your WordPress admin</li>
          <li>Go to <span className="font-medium text-slate-800">Users → Profile</span></li>
          <li>Your username is shown under <span className="font-medium text-slate-800">"Username"</span> — it cannot be changed</li>
        </ol>
        <p className="text-slate-500 mt-1.5 text-[12px]">Use your login username, not your display name or email.</p>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className="font-semibold text-slate-800 mb-1">Creating an Application Password</p>
        <ol className="space-y-1 text-slate-600 list-decimal list-inside">
          <li>Go to <span className="font-medium text-slate-800">Users → Profile</span></li>
          <li>Scroll to the <span className="font-medium text-slate-800">"Application Passwords"</span> section at the bottom</li>
          <li>Enter a name — e.g. <span className="font-medium text-slate-800">Something Inc SEO</span></li>
          <li>Click <span className="font-medium text-slate-800">"Add New Application Password"</span></li>
          <li>Copy the password shown — <span className="font-medium text-red-600">it will not be shown again</span></li>
          <li>Paste it in the Application Password field and save</li>
        </ol>
        <p className="text-slate-500 mt-1.5 text-[12px]">
          Application Passwords are separate from your login password. The user needs at least Editor role for SEO changes to work.
        </p>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className="font-semibold text-slate-800 mb-1">Don&apos;t see Application Passwords?</p>
        <p className="text-slate-600">
          They require WordPress 5.6+ and HTTPS. If the section is missing, your host may have disabled them — contact us and we can help configure access another way.
        </p>
      </div>
    </div>
  );
}

function ShopifyHelpPanel() {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-[13px]">
      <p className="font-semibold text-slate-800 mb-2">Shopify Access Token</p>
      <ol className="space-y-1 text-slate-600 list-decimal list-inside">
        <li>Go to your Shopify admin → <span className="font-medium text-slate-800">Apps → Develop apps</span></li>
        <li>Create a custom app and grant <span className="font-medium text-slate-800">read/write access</span> to Online Store content</li>
        <li>Install the app and copy the Admin API access token</li>
      </ol>
      <p className="text-slate-500 mt-2 text-[12px]">Contact us if you need help setting this up.</p>
    </div>
  );
}

export default function SettingsPage() {
  const params = useParams();
  const token = params.token as string;
  const { toast, show } = useToast();

  // CMS state
  const [client, setClient] = useState<ClientData | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [seoPlugin, setSeoPlugin] = useState("");
  const [pageBuilder, setPageBuilder] = useState("");
  const [savingCms, setSavingCms] = useState(false);
  const [testingWp, setTestingWp] = useState(false);
  const [wpTestResult, setWpTestResult] = useState<TestResult | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    fetch(`/api/portal/settings/client-data?token=${token}`)
      .then((r) => r.json())
      .then((data: ClientData) => {
        setClient(data);
        setWpUsername(data.wp_username || "");
        setWpAppPassword(data.wp_app_password || "");
        setSeoPlugin(data.seo_plugin || "");
        setPageBuilder(data.page_builder || "");
      })
      .catch(() => show("Failed to load settings", "error"))
      .finally(() => setLoadingClient(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function saveCmsCredentials() {
    setSavingCms(true);
    setWpTestResult(null);
    try {
      const res = await fetch("/api/portal/settings/cms-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wp_username: wpUsername, wp_app_password: wpAppPassword, seo_plugin: seoPlugin, page_builder: pageBuilder }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      show("CMS credentials saved", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSavingCms(false);
    }
  }

  async function testWpConnection() {
    setTestingWp(true);
    setWpTestResult(null);
    try {
      // Pass current form values so you can test before saving
      const res = await fetch("/api/portal/settings/test-wp-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wp_username: wpUsername, wp_app_password: wpAppPassword }),
      });
      const data = await res.json() as TestResult;
      setWpTestResult(data);
    } catch {
      setWpTestResult({ ok: false, error: "Request failed" });
    } finally {
      setTestingWp(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      show("New passwords do not match", "error");
      return;
    }
    if (newPassword.length < 8) {
      show("New password must be at least 8 characters", "error");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/portal/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Password change failed");
      show("Password updated successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      show(err instanceof Error ? err.message : "Password change failed", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  const cms = client?.cms?.toLowerCase() ?? "";
  const isWordPress = cms === "wordpress";
  const isShopify = cms === "shopify";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your CMS credentials and account security.</p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
              : "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* CMS Credentials */}
      <div className={isWordPress || isShopify ? "grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start" : ""}>
        <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_0_rgba(16,24,40,0.04)]">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">CMS Credentials</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {loadingClient
                ? "Loading…"
                : isWordPress
                ? `WordPress — ${client?.site_url || "your site"}`
                : client?.cms
                ? `${client.cms}`
                : "No CMS on file"}
            </p>
          </div>

          {loadingClient ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : isWordPress ? (
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">WordPress Username</label>
                  <input
                    type="text"
                    value={wpUsername}
                    onChange={(e) => { setWpUsername(e.target.value); setWpTestResult(null); }}
                    placeholder="admin"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Application Password</label>
                  <input
                    type="password"
                    value={wpAppPassword}
                    onChange={(e) => { setWpAppPassword(e.target.value); setWpTestResult(null); }}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">SEO Plugin</label>
                  <select
                    value={seoPlugin}
                    onChange={(e) => setSeoPlugin(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition bg-white"
                  >
                    <option value="">Select plugin…</option>
                    {SEO_PLUGINS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Page Builder</label>
                  <select
                    value={pageBuilder}
                    onChange={(e) => setPageBuilder(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition bg-white"
                  >
                    <option value="">Select builder…</option>
                    {PAGE_BUILDERS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* Test result */}
              {wpTestResult && (
                <div
                  className={`rounded-lg px-4 py-3 text-[13px] ${
                    wpTestResult.ok
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                      : "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200"
                  }`}
                >
                  {wpTestResult.ok
                    ? `Connected — logged in as ${wpTestResult.wp_user}${wpTestResult.roles?.length ? ` (${wpTestResult.roles.join(", ")})` : ""}`
                    : wpTestResult.error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={saveCmsCredentials}
                  disabled={savingCms}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {savingCms ? "Saving…" : "Save credentials"}
                </button>
                <button
                  onClick={testWpConnection}
                  disabled={testingWp || !wpUsername || !wpAppPassword}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {testingWp ? "Testing…" : "Test connection"}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-[13px] text-slate-500">
                CMS credential updates for{" "}
                <span className="font-medium text-slate-700">{client?.cms || "your platform"}</span>{" "}
                are handled by our team.{" "}
                <a
                  href="https://calendly.com/somethinginc/something-inc-touchbase-1"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-700 underline underline-offset-2 hover:text-slate-900"
                >
                  Book a call
                </a>{" "}
                or email us to make changes.
              </p>
            </div>
          )}
        </section>

        {/* Help panel — shown alongside form for WordPress / Shopify */}
        {isWordPress && <WpHelpPanel />}
        {isShopify && <ShopifyHelpPanel />}
      </div>

      {/* Security — Change Password */}
      <section className="max-w-xl bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_0_rgba(16,24,40,0.04)]">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Security</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Change your portal login password.</p>
        </div>
        <form onSubmit={changePassword} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
            />
          </div>
          <div className="pt-1">
            <button
              type="submit"
              disabled={savingPassword}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
