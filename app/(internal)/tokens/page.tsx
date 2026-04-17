"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { InviteToken, PackageTier } from "@/lib/supabase";

const PACKAGE_LABELS: Record<PackageTier, string> = {
  starter: "Starter",
  growth: "Growth",
  authority: "Authority",
};

const PACKAGE_COLORS: Record<PackageTier, string> = {
  starter: "bg-slate-100 text-slate-700 border-slate-200",
  growth: "bg-indigo-50 text-indigo-700 border-indigo-200",
  authority: "bg-violet-50 text-violet-700 border-violet-200",
};

function tokenStatus(t: InviteToken): { label: string; className: string } {
  if (t.used_at) return { label: "Used", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (new Date(t.expires_at) < new Date()) return { label: "Expired", className: "bg-red-50 text-red-700 border-red-200" };
  return { label: "Active", className: "bg-amber-50 text-amber-700 border-amber-200" };
}

const inputClass =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white placeholder:text-slate-300";

const INTAKE_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/intake`
    : process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/intake`
    : "/intake";

export default function AddClientPage() {
  const [tokens, setTokens] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate form
  const [tier, setTier] = useState<PackageTier>("growth");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<"token" | "message" | null>(null);

  // Revoke
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/tokens/list");
    if (res.ok) {
      const data = await res.json();
      setTokens(data.tokens ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenError(null);
    setLatestToken(null);
    setCopied(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/tokens/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_tier: tier, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error || "Failed to generate token");
      } else {
        setLatestToken(data.token.token);
        setNotes("");
        load();
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(token: string) {
    if (!confirm(`Revoke token ${token}? It will no longer be usable.`)) return;
    setRevoking(token);
    await fetch(`/api/tokens/${token}`, { method: "DELETE" });
    setRevoking(null);
    load();
  }

  async function copyText(text: string, which: "token" | "message") {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  const intakeUrl =
    typeof window !== "undefined" ? `${window.location.origin}/intake` : INTAKE_URL;

  const sendMessage = latestToken
    ? `Hi! Here's your link to get started with your SEO program:\n\n${intakeUrl}\n\nYour invite token: ${latestToken}\n\nYou'll need to enter this token in the form to unlock your ${PACKAGE_LABELS[tier]} package. It's valid for 30 days — let me know if you have any questions!`
    : "";

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Add a Client</h1>
        <p className="text-slate-500 text-sm mt-1">
          Generate an invite token for a new prospect. They enter it in the intake form to verify their package.
        </p>
      </div>

      {/* ── Intake form URL — always visible ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-500 mb-0.5">Onboarding form link</div>
          <code className="text-sm font-mono text-slate-700 truncate block">{intakeUrl}</code>
        </div>
        <button
          type="button"
          onClick={() => copyText(intakeUrl, "token")}
          className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0 transition-colors"
        >
          {copied === "token" ? "Copied!" : "Copy link"}
        </button>
      </div>

      {/* ── Step 1: Generate ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">1</span>
          <h2 className="text-sm font-semibold text-slate-700">Choose a package and generate a token</h2>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Package picker */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Package</label>
              <div className="grid grid-cols-3 gap-2">
                {(["starter", "growth", "authority"] as PackageTier[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      tier === t
                        ? t === "starter"
                          ? "border-slate-400 bg-slate-50 text-slate-800"
                          : t === "growth"
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                          : "border-violet-500 bg-violet-50 text-violet-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {PACKAGE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes <span className="font-normal text-slate-400">(optional — for your reference)</span>
              </label>
              <input
                type="text"
                className={inputClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Acme Corp, referred by Jane"
              />
            </div>

            {genError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {genError}
              </div>
            )}

            <button
              type="submit"
              disabled={generating}
              className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {generating ? "Generating…" : "Generate Token"}
            </button>
          </form>
        </div>
      </section>

      {/* ── Step 2: Send ── */}
      {latestToken && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">2</span>
            <h2 className="text-sm font-semibold text-slate-700">Send this to the client</h2>
          </div>
          <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4">
            {/* Quick-copy individual fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div className="text-xs text-slate-400 mb-1">Intake form URL</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-slate-700 flex-1 truncate">{intakeUrl}</code>
                  <button
                    onClick={() => copyText(intakeUrl, "token")}
                    className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0 transition-colors"
                  >
                    {copied === "token" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                <div className="text-xs text-indigo-500 mb-1">Invite token ({PACKAGE_LABELS[tier]})</div>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-mono font-bold text-indigo-900 tracking-widest flex-1">{latestToken}</code>
                </div>
              </div>
            </div>

            {/* Ready-to-send message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-500">Ready-to-send message</span>
                <button
                  onClick={() => copyText(sendMessage, "message")}
                  className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {copied === "message" ? "Copied!" : "Copy message"}
                </button>
              </div>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">
                {sendMessage}
              </pre>
            </div>
          </div>
        </section>
      )}

      {/* ── Token history ── */}
      <section>
        <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">
          Token History
        </h2>
        <GlassCard>
          {loading ? (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : tokens.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              No tokens yet — generate one above to get started.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tokens.map((t) => {
                const status = tokenStatus(t);
                const isRevocable = !t.used_at && new Date(t.expires_at) > new Date();
                return (
                  <div key={t.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-mono font-semibold text-slate-800 tracking-wide">
                          {t.token}
                        </code>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PACKAGE_COLORS[t.package_tier]}`}>
                          {PACKAGE_LABELS[t.package_tier]}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Created {new Date(t.created_at).toLocaleDateString()}
                        {t.notes && <span className="ml-2 text-slate-500">· {t.notes}</span>}
                        {t.used_at && (
                          <span className="ml-2">· Used {new Date(t.used_at).toLocaleDateString()}</span>
                        )}
                        {!t.used_at && new Date(t.expires_at) > new Date() && (
                          <span className="ml-2">
                            · Expires {new Date(t.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isRevocable && (
                        <button
                          onClick={() => handleRevoke(t.token)}
                          disabled={revoking === t.token}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {revoking === t.token ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </section>
    </div>
  );
}
