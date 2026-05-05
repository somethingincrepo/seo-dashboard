"use client";

import { useEffect, useState } from "react";
import type { ConnectionPublic, Platform } from "@/lib/connections/types";

type Props = {
  // The active platform from client.cms (mapped to Platform via platformFromCmsField).
  platform: Platform;
  // Optional client_id — required when called from the admin context. Portal infers from session.
  clientId?: string;
  // Optional: where to return after a completed OAuth flow (defaults to current URL).
  redirectAfter?: string;
};

type TestResult =
  | { ok: true; capabilities?: Record<string, boolean>; displayName?: string }
  | { ok: false; reason: string; error: string };

const inputCls =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition";
const labelCls = "block text-[13px] font-medium text-slate-700 mb-1.5";
const primaryBtn =
  "px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition";
const secondaryBtn =
  "px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition";

export function ConnectionForm({ platform, clientId, redirectAfter }: Props) {
  const [existing, setExisting] = useState<ConnectionPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const url = clientId ? `/api/connections/list?client_id=${encodeURIComponent(clientId)}` : "/api/connections/list";
    fetch(url)
      .then((r) => r.json())
      .then((data: { ok: boolean; connections?: ConnectionPublic[] }) => {
        if (data.ok && data.connections) {
          const match = data.connections.find((c) => c.platform === platform && c.status !== "revoked");
          setExisting(match ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [platform, clientId]);

  async function submitManual(credentials: Record<string, string>) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/connections/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, platform, credentials }),
      });
      const data = await res.json() as { ok: boolean; connection?: ConnectionPublic; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Connection failed");
      setExisting(data.connection ?? null);
      setSuccess("Connected successfully");
      setTestResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function startOauth(extra?: Record<string, string>) {
    setError(null);
    setSuccess(null);
    const params = new URLSearchParams();
    if (clientId) params.set("client_id", clientId);
    if (redirectAfter || typeof window !== "undefined") {
      params.set("redirect_after", redirectAfter ?? window.location.pathname + window.location.search);
    }
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    window.location.href = `/api/connections/${platform}/authorize?${params.toString()}`;
  }

  async function disconnect() {
    if (!existing) return;
    if (!confirm("Disconnect this connection? You can reconnect later.")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/connections/${existing.id}`, { method: "DELETE" });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Disconnect failed");
      setExisting(null);
      setSuccess("Disconnected");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function testConnection() {
    if (!existing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/connections/${existing.id}/test`, { method: "POST" });
      const data = await res.json() as TestResult;
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, reason: "network", error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div className="py-6 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="space-y-4">
      {existing && existing.status !== "revoked" && (
        <ConnectedState
          connection={existing}
          onTest={testConnection}
          onDisconnect={disconnect}
          testing={testing}
          submitting={submitting}
          testResult={testResult}
        />
      )}

      {(!existing || existing.status === "revoked") && (
        <PlatformFields
          platform={platform}
          submitting={submitting}
          onSubmitManual={submitManual}
          onStartOauth={startOauth}
        />
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 text-[13px] bg-red-50 text-red-800 ring-1 ring-inset ring-red-200">
          {error}
        </div>
      )}
      {success && !error && (
        <div className="rounded-lg px-4 py-3 text-[13px] bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200">
          {success}
        </div>
      )}
    </div>
  );
}

function ConnectedState({
  connection,
  onTest,
  onDisconnect,
  testing,
  submitting,
  testResult,
}: {
  connection: ConnectionPublic;
  onTest: () => void;
  onDisconnect: () => void;
  testing: boolean;
  submitting: boolean;
  testResult: TestResult | null;
}) {
  const statusColor =
    connection.status === "active" ? "emerald" :
    connection.status === "expired" ? "amber" :
    connection.status === "revoked" ? "slate" : "red";

  const enabledCaps = Object.entries(connection.capabilities ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-slate-900">{connection.display_name || connection.platform}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-${statusColor}-50 text-${statusColor}-700 ring-1 ring-inset ring-${statusColor}-200`}>
              {connection.status}
            </span>
          </div>
          {connection.last_verified_at && (
            <div className="text-[11px] text-slate-400 mt-1">
              Last verified {new Date(connection.last_verified_at).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onTest} disabled={testing || submitting} className={secondaryBtn}>
            {testing ? "Testing…" : "Test"}
          </button>
          <button onClick={onDisconnect} disabled={submitting} className={secondaryBtn}>
            Disconnect
          </button>
        </div>
      </div>

      {enabledCaps.length > 0 && (
        <div className="text-[12px] text-slate-500">
          <span className="text-slate-400">Capabilities:</span>{" "}
          {enabledCaps.join(", ")}
        </div>
      )}

      {testResult && (
        <div
          className={`rounded-lg px-3 py-2 text-[13px] ${
            testResult.ok
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
              : "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200"
          }`}
        >
          {testResult.ok
            ? `Connection healthy${testResult.displayName ? ` — ${testResult.displayName}` : ""}`
            : testResult.error}
        </div>
      )}
    </div>
  );
}

function PlatformFields({
  platform,
  submitting,
  onSubmitManual,
  onStartOauth,
}: {
  platform: Platform;
  submitting: boolean;
  onSubmitManual: (creds: Record<string, string>) => void;
  onStartOauth: (extra?: Record<string, string>) => void;
}) {
  if (platform === "wordpress_self") return <WordPressFields submitting={submitting} onSubmit={onSubmitManual} />;
  if (platform === "shopify") return <ShopifyOauth submitting={submitting} onConnect={onStartOauth} />;
  if (platform === "hubspot") return <HubspotOauth submitting={submitting} onConnect={onStartOauth} />;
  if (platform === "webflow") return <WebflowOauth submitting={submitting} onConnect={onStartOauth} />;
  if (platform === "cloudflare") return <CloudflareFields submitting={submitting} onSubmit={onSubmitManual} />;
  if (platform === "framer" || platform === "squarespace" || platform === "wix") {
    return <ManualOnlyNotice platform={platform} submitting={submitting} onSubmit={onSubmitManual} />;
  }
  return <div className="text-sm text-slate-500">No connection flow configured for {platform}.</div>;
}

function WordPressFields({ submitting, onSubmit }: { submitting: boolean; onSubmit: (c: Record<string, string>) => void }) {
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [seoPlugin, setSeoPlugin] = useState("");
  const [pageBuilder, setPageBuilder] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ site_url: siteUrl, username, application_password: appPassword, seo_plugin: seoPlugin, page_builder: pageBuilder });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Site URL</label>
          <input className={inputCls} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" />
        </div>
        <div>
          <label className={labelCls}>WordPress Username</label>
          <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
        </div>
        <div>
          <label className={labelCls}>Application Password</label>
          <input type="password" className={inputCls} value={appPassword} onChange={(e) => setAppPassword(e.target.value)} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" />
        </div>
        <div>
          <label className={labelCls}>SEO Plugin</label>
          <select className={inputCls} value={seoPlugin} onChange={(e) => setSeoPlugin(e.target.value)}>
            <option value="">Select…</option>
            <option value="yoast">Yoast SEO</option>
            <option value="rankmath">RankMath</option>
            <option value="aioseo">AIOSEO</option>
            <option value="seopress">SEOPress</option>
            <option value="other">Other / None</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Page Builder</label>
          <select className={inputCls} value={pageBuilder} onChange={(e) => setPageBuilder(e.target.value)}>
            <option value="">Gutenberg (default)</option>
            <option value="elementor">Elementor</option>
            <option value="divi">Divi</option>
            <option value="beaver">Beaver Builder</option>
            <option value="bricks">Bricks</option>
            <option value="oxygen">Oxygen</option>
          </select>
        </div>
      </div>
      <button type="submit" disabled={submitting || !siteUrl || !username || !appPassword} className={primaryBtn}>
        {submitting ? "Connecting…" : "Connect WordPress"}
      </button>
    </form>
  );
}

function ShopifyOauth({ submitting, onConnect }: { submitting: boolean; onConnect: (e?: Record<string, string>) => void }) {
  const [shopDomain, setShopDomain] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Shop domain</label>
        <input
          className={inputCls}
          value={shopDomain}
          onChange={(e) => setShopDomain(e.target.value)}
          placeholder="yourshop.myshopify.com"
        />
        <p className="text-[11px] text-slate-400 mt-1">Use your full myshopify.com domain (not the storefront URL).</p>
      </div>
      <button
        onClick={() => onConnect({ shop_domain: shopDomain })}
        disabled={submitting || !shopDomain}
        className={primaryBtn}
      >
        Connect Shopify with OAuth
      </button>
      <p className="text-[12px] text-slate-500">
        Clicking will redirect you to Shopify to approve the install. We&apos;ll never see your store password.
      </p>
    </div>
  );
}

function HubspotOauth({ submitting, onConnect }: { submitting: boolean; onConnect: (e?: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <button onClick={() => onConnect()} disabled={submitting} className={primaryBtn}>
        Connect HubSpot with OAuth
      </button>
      <p className="text-[12px] text-slate-500">
        We&apos;ll redirect you to HubSpot to approve access to your portal&apos;s CMS.
      </p>
    </div>
  );
}

function WebflowOauth({ submitting, onConnect }: { submitting: boolean; onConnect: (e?: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <button onClick={() => onConnect()} disabled={submitting} className={primaryBtn}>
        Connect Webflow with OAuth
      </button>
      <p className="text-[12px] text-slate-500">
        We&apos;ll redirect you to Webflow to authorize site + CMS access.
      </p>
    </div>
  );
}

function CloudflareFields({ submitting, onSubmit }: { submitting: boolean; onSubmit: (c: Record<string, string>) => void }) {
  const [zoneId, setZoneId] = useState("");
  const [apiToken, setApiToken] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ zone_id: zoneId, api_token: apiToken });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Zone ID</label>
          <input className={inputCls} value={zoneId} onChange={(e) => setZoneId(e.target.value)} placeholder="32-char hex string" />
          <p className="text-[11px] text-slate-400 mt-1">Cloudflare → your domain → Overview → API → Zone ID.</p>
        </div>
        <div>
          <label className={labelCls}>API Token</label>
          <input type="password" className={inputCls} value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="Token with Zone:Edit scope" />
          <p className="text-[11px] text-slate-400 mt-1">Create at Profile → API Tokens. Needs Zone:Edit scope.</p>
        </div>
      </div>
      <button type="submit" disabled={submitting || !zoneId || !apiToken} className={primaryBtn}>
        {submitting ? "Connecting…" : "Connect Cloudflare"}
      </button>
    </form>
  );
}

function ManualOnlyNotice({
  platform,
  submitting,
  onSubmit,
}: {
  platform: Platform;
  submitting: boolean;
  onSubmit: (c: Record<string, string>) => void;
}) {
  const [siteUrl, setSiteUrl] = useState("");
  const labels: Record<string, string> = { framer: "Framer", squarespace: "Squarespace", wix: "Wix" };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ site_url: siteUrl });
      }}
      className="space-y-4"
    >
      <div className="rounded-lg px-4 py-3 text-[13px] bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200">
        {labels[platform] || platform} doesn&apos;t expose a public publishing API we can write to. Recording your site here lets us flag changes as manual — we&apos;ll send you implementation notes for each.
      </div>
      <div>
        <label className={labelCls}>Site URL</label>
        <input className={inputCls} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" />
      </div>
      <button type="submit" disabled={submitting || !siteUrl} className={primaryBtn}>
        {submitting ? "Saving…" : "Record site"}
      </button>
    </form>
  );
}
