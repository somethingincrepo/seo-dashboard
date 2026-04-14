"use client";
import { useState } from "react";
import { CopyButton } from "./CopyButton";

interface GenerateCredentialsButtonProps {
  clientId: string;
  hasCredentials: boolean;
}

type Credentials = { username: string; password: string };

export function GenerateCredentialsButton({
  clientId,
  hasCredentials,
}: GenerateCredentialsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);

  async function handleGenerate() {
    if (
      hasCredentials &&
      !confirm(
        "This will replace the existing credentials. The old password will stop working. Continue?"
      )
    )
      return;

    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/generate-credentials`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setCreds(data);
      }
    } finally {
      setLoading(false);
    }
  }

  const loginUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/portal/login`
      : "/portal/login";

  return (
    <div className="space-y-3">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="px-4 py-2 rounded-xl text-sm border transition-all disabled:opacity-40 bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100"
      >
        {loading
          ? "Generating…"
          : hasCredentials
          ? "Regenerate Credentials"
          : "Generate Credentials"}
      </button>

      {creds && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-left">
          <p className="text-xs text-amber-700 font-medium">
            Save these now — the password won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-20 shrink-0">Username</span>
            <code className="text-sm font-mono text-slate-800 flex-1">{creds.username}</code>
            <CopyButton value={creds.username} label="Copy" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-20 shrink-0">Password</span>
            <code className="text-sm font-mono text-slate-800 flex-1">{creds.password}</code>
            <CopyButton value={creds.password} label="Copy" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-20 shrink-0">Login URL</span>
            <code className="text-sm font-mono text-indigo-600 flex-1">{loginUrl}</code>
            <CopyButton value={loginUrl} label="Copy" />
          </div>
        </div>
      )}
    </div>
  );
}
