"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

const SEO_PLUGINS = ["Yoast", "RankMath", "AIOSEO", "SEOPress", "Other / None"];
const PAGE_BUILDERS = ["Gutenberg (Block Editor)", "Elementor", "Divi", "Beaver Builder", "Bricks", "Oxygen", "Other"];

type Section = "credentials" | "security";

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

// ── Help panel helpers ───────────────────────────────────────────────────────

function HelpStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span className="text-slate-600 text-[13px]">{children}</span>
    </li>
  );
}

function ContactRow() {
  return (
    <p className="text-[12px] text-slate-500 pt-1">
      Once you have the credentials, email them to{" "}
      <a href="mailto:reporting@somethingincorporated.io" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
        reporting@somethingincorporated.io
      </a>{" "}
      or{" "}
      <a
        href="https://calendly.com/somethinginc/something-inc-touchbase-1"
        target="_blank"
        rel="noreferrer"
        className="text-slate-700 underline underline-offset-2 hover:text-slate-900"
      >
        book a call
      </a>{" "}
      and we&apos;ll set it up.
    </p>
  );
}

function WpHelpPanel() {
  return (
    <div className="space-y-5 text-[13px]">
      <div>
        <p className="font-semibold text-slate-800 mb-2">Finding your username</p>
        <ul className="space-y-1.5 list-none">
          <HelpStep n={1}>Log in to your WordPress admin</HelpStep>
          <HelpStep n={2}>Go to <strong className="text-slate-800">Users → Profile</strong></HelpStep>
          <HelpStep n={3}>Your username appears under <strong className="text-slate-800">"Username"</strong> — it can&apos;t be changed. Use this, not your display name or email.</HelpStep>
        </ul>
      </div>
      <div className="border-t border-slate-200 pt-4">
        <p className="font-semibold text-slate-800 mb-2">Creating an Application Password</p>
        <ul className="space-y-1.5 list-none">
          <HelpStep n={1}>Go to <strong className="text-slate-800">Users → Profile</strong></HelpStep>
          <HelpStep n={2}>Scroll to <strong className="text-slate-800">"Application Passwords"</strong> near the bottom</HelpStep>
          <HelpStep n={3}>Enter a name — e.g. <strong className="text-slate-800">Something Inc SEO</strong></HelpStep>
          <HelpStep n={4}>Click <strong className="text-slate-800">"Add New Application Password"</strong></HelpStep>
          <HelpStep n={5}>Copy the password — <strong className="text-red-600">it won&apos;t be shown again</strong></HelpStep>
          <HelpStep n={6}>Paste it in the field and save</HelpStep>
        </ul>
        <p className="text-[12px] text-slate-500 mt-2">The account needs at least <strong className="text-slate-700">Editor</strong> role. Requires WordPress 5.6+ and HTTPS.</p>
      </div>
      <div className="border-t border-slate-200 pt-4">
        <p className="font-semibold text-slate-800 mb-1">Don&apos;t see Application Passwords?</p>
        <p className="text-slate-600 text-[12px]">Your host may have disabled the REST API or Application Passwords. Contact us and we&apos;ll help configure access another way.</p>
      </div>
    </div>
  );
}

function ShopifyHelpPanel() {
  return (
    <div className="space-y-4 text-[13px]">
      <div>
        <p className="font-semibold text-slate-800 mb-2">Creating a Custom App API token</p>
        <ul className="space-y-1.5 list-none">
          <HelpStep n={1}>Shopify Admin → <strong className="text-slate-800">Settings → Apps and sales channels</strong></HelpStep>
          <HelpStep n={2}>Click <strong className="text-slate-800">Develop apps → Create an app</strong> and name it <strong className="text-slate-800">Something Inc SEO</strong></HelpStep>
          <HelpStep n={3}>Under <strong className="text-slate-800">Configuration → Admin API access scopes</strong> enable: <span className="text-[12px] text-slate-500">write_content, read_content, write_themes, read_themes, write_metafields, read_metafields, write_products, read_products</span></HelpStep>
          <HelpStep n={4}>Click <strong className="text-slate-800">Save → Install app</strong></HelpStep>
          <HelpStep n={5}>Under <strong className="text-slate-800">API credentials</strong>, click <strong className="text-slate-800">Reveal token once</strong> and copy it</HelpStep>
        </ul>
        <p className="text-[12px] text-slate-500 mt-2">The token is shown only once when you install the app.</p>
      </div>
      <div className="border-t border-slate-200 pt-4"><ContactRow /></div>
    </div>
  );
}

function WebflowHelpPanel() {
  return (
    <div className="space-y-4 text-[13px]">
      <div>
        <p className="font-semibold text-slate-800 mb-2">Generating a Webflow API token</p>
        <ul className="space-y-1.5 list-none">
          <HelpStep n={1}>Log in to Webflow → <strong className="text-slate-800">Workspace Settings → Integrations → API access</strong></HelpStep>
          <HelpStep n={2}>Click <strong className="text-slate-800">Generate token</strong> and copy it — shown once</HelpStep>
          <HelpStep n={3}>Also send us your <strong className="text-slate-800">Site ID</strong> — found under <strong className="text-slate-800">Project Settings → General → Site ID</strong></HelpStep>
        </ul>
      </div>
      <div className="border-t border-slate-200 pt-4"><ContactRow /></div>
    </div>
  );
}

function HubSpotHelpPanel() {
  return (
    <div className="space-y-4 text-[13px]">
      <div>
        <p className="font-semibold text-slate-800 mb-2">Creating a Private App token</p>
        <ul className="space-y-1.5 list-none">
          <HelpStep n={1}>HubSpot → <strong className="text-slate-800">Settings → Integrations → Private Apps → Create a private app</strong></HelpStep>
          <HelpStep n={2}>Name it <strong className="text-slate-800">Something Inc SEO</strong></HelpStep>
          <HelpStep n={3}>Under Scopes, enable read + write for: <span className="text-[12px] text-slate-500">CMS → Blog Posts, CMS → Pages, CMS → SEO</span></HelpStep>
          <HelpStep n={4}>Click <strong className="text-slate-800">Create app</strong> and copy the access token</HelpStep>
        </ul>
        <p className="text-[12px] text-slate-500 mt-2">HubSpot deprecated legacy API keys — Private App tokens are the current standard.</p>
      </div>
      <div className="border-t border-slate-200 pt-4"><ContactRow /></div>
    </div>
  );
}

function SquarespaceHelpPanel() {
  return (
    <div className="space-y-4 text-[13px]">
      <div>
        <p className="font-semibold text-slate-800 mb-2">Generating a Squarespace API key</p>
        <ul className="space-y-1.5 list-none">
          <HelpStep n={1}>Log in to Squarespace and open your site</HelpStep>
          <HelpStep n={2}><strong className="text-slate-800">Settings → Developer Tools → API Keys</strong></HelpStep>
          <HelpStep n={3}>Click <strong className="text-slate-800">Generate Key</strong> and enable <strong className="text-slate-800">Pages</strong> + <strong className="text-slate-800">Blog Posts</strong> (read + write)</HelpStep>
          <HelpStep n={4}>Copy the key</HelpStep>
        </ul>
        <p className="text-[12px] text-slate-500 mt-2">If you don&apos;t see Developer Tools, your plan may not include API access — contact us.</p>
      </div>
      <div className="border-t border-slate-200 pt-4"><ContactRow /></div>
    </div>
  );
}

function WixHelpPanel() {
  return (
    <div className="space-y-4 text-[13px]">
      <div>
        <p className="font-semibold text-slate-800 mb-2">Creating a Wix API key</p>
        <ul className="space-y-1.5 list-none">
          <HelpStep n={1}>Go to your <strong className="text-slate-800">Wix Site Dashboard → Settings → Advanced → API Keys</strong></HelpStep>
          <HelpStep n={2}>Click <strong className="text-slate-800">Generate API Key</strong></HelpStep>
          <HelpStep n={3}>Name it <strong className="text-slate-800">Something Inc SEO</strong> and enable All site permissions (or CMS + SEO)</HelpStep>
          <HelpStep n={4}>Copy the key — shown once</HelpStep>
        </ul>
        <p className="text-[12px] text-slate-500 mt-2">Also send us your <strong className="text-slate-700">Account ID</strong> and <strong className="text-slate-700">Site ID</strong> — both visible in your Wix dashboard URL.</p>
      </div>
      <div className="border-t border-slate-200 pt-4"><ContactRow /></div>
    </div>
  );
}

function FramerHelpPanel() {
  return (
    <div className="space-y-4 text-[13px]">
      <div>
        <p className="font-semibold text-slate-800 mb-2">Granting access on Framer</p>
        <p className="text-slate-600 mb-3">Framer&apos;s external API is limited, so the most effective approach is direct project access.</p>
        <ul className="space-y-1.5 list-none">
          <HelpStep n={1}>Open your project in Framer</HelpStep>
          <HelpStep n={2}>Click <strong className="text-slate-800">Share</strong> in the top bar</HelpStep>
          <HelpStep n={3}>Invite <strong className="text-slate-800">reporting@somethingincorporated.io</strong> as an <strong className="text-slate-800">Editor</strong></HelpStep>
        </ul>
        <p className="text-[12px] text-slate-500 mt-2">Prefer API access? Contact us and we&apos;ll walk you through the Framer CMS REST token setup.</p>
      </div>
      <div className="border-t border-slate-200 pt-4"><ContactRow /></div>
    </div>
  );
}

function CustomHelpPanel({ cmsName }: { cmsName: string }) {
  return (
    <div className="space-y-3 text-[13px]">
      <p className="font-semibold text-slate-800">Setting up access for {cmsName}</p>
      <p className="text-slate-600">Every custom setup is a little different. Reach out and we&apos;ll figure out the right approach for your platform.</p>
      <ContactRow />
    </div>
  );
}

function CmsHelpPanel({ cms }: { cms: string }) {
  const c = cms.toLowerCase();
  if (c === "wordpress") return <WpHelpPanel />;
  if (c === "shopify") return <ShopifyHelpPanel />;
  if (c === "webflow") return <WebflowHelpPanel />;
  if (c === "hubspot") return <HubSpotHelpPanel />;
  if (c === "squarespace") return <SquarespaceHelpPanel />;
  if (c === "wix") return <WixHelpPanel />;
  if (c === "framer") return <FramerHelpPanel />;
  return <CustomHelpPanel cmsName={cms} />;
}

// ── Settings nav items ───────────────────────────────────────────────────────

const SECTIONS: { id: Section; label: string; description: string }[] = [
  { id: "credentials", label: "Credentials", description: "CMS API access" },
  { id: "security",    label: "Security",     description: "Change password" },
];

// ── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params = useParams();
  const token = params.token as string;
  const { toast, show } = useToast();

  const [activeSection, setActiveSection] = useState<Section>("credentials");

  const [client, setClient] = useState<ClientData | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [seoPlugin, setSeoPlugin] = useState("");
  const [pageBuilder, setPageBuilder] = useState("");
  const [savingCms, setSavingCms] = useState(false);
  const [testingWp, setTestingWp] = useState(false);
  const [wpTestResult, setWpTestResult] = useState<TestResult | null>(null);

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
    if (newPassword !== confirmPassword) { show("New passwords do not match", "error"); return; }
    if (newPassword.length < 8) { show("New password must be at least 8 characters", "error"); return; }
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
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      show(err instanceof Error ? err.message : "Password change failed", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  const cms = client?.cms ?? "";
  const isWordPress = cms.toLowerCase() === "wordpress";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your CMS credentials and account security.</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === "success"
            ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
            : "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Settings panel: left sub-nav + right content */}
      <div className="flex gap-0 bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_0_rgba(16,24,40,0.04)] overflow-hidden min-h-[420px]">

        {/* Left sub-nav */}
        <nav className="w-48 shrink-0 border-r border-slate-100 py-3 flex flex-col gap-0.5 px-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                activeSection === s.id
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <div className={cn("text-[13px] font-medium", activeSection === s.id ? "text-slate-900" : "text-slate-700")}>
                {s.label}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{s.description}</div>
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="flex-1 min-w-0">

          {/* ── Credentials ── */}
          {activeSection === "credentials" && (
            <div>
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">CMS Credentials</h2>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  {loadingClient ? "Loading…" : cms ? `${cms}${client?.site_url ? ` — ${client.site_url}` : ""}` : "No CMS on file"}
                </p>
              </div>

              <div className={cn("p-6", isWordPress ? "grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start" : "")}>

                {/* Form area */}
                {loadingClient ? (
                  <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : isWordPress ? (
                  <div className="space-y-4">
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

                    {wpTestResult && (
                      <div className={`rounded-lg px-4 py-3 text-[13px] ${
                        wpTestResult.ok
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                          : "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200"
                      }`}>
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
                  <div>
                    <p className="text-[13px] text-slate-600 mb-4">
                      Your site runs on <strong className="text-slate-800">{cms || "an unsupported platform"}</strong>.
                      Follow the instructions on the right to generate the credentials we need, then send them over and we&apos;ll configure the integration.
                    </p>
                  </div>
                )}

                {/* Help panel — only rendered when CMS is known */}
                {!loadingClient && cms && (
                  <div className={cn(
                    "bg-slate-50 rounded-xl border border-slate-200 p-5",
                    isWordPress ? "" : "mt-0"
                  )}>
                    <CmsHelpPanel cms={cms} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Security ── */}
          {activeSection === "security" && (
            <div>
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Security</h2>
                <p className="text-[13px] text-slate-500 mt-0.5">Change your portal login password.</p>
              </div>
              <form onSubmit={changePassword} className="px-6 py-5 space-y-4 max-w-sm">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Current password</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    required autoComplete="current-password"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">New password</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    required minLength={8} autoComplete="new-password"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Confirm new password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    required autoComplete="new-password"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition" />
                </div>
                <div className="pt-1">
                  <button type="submit" disabled={savingPassword}
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
                    {savingPassword ? "Updating…" : "Update password"}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
