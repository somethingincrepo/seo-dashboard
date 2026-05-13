"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  sessionId: string;
  username: string;
}

export function RevokeSessionButton({ sessionId, username }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRevoke() {
    if (!confirm(`Revoke session for ${username}? They will need to log in again.`)) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/sessions/${sessionId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRevoke}
      disabled={loading}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
    >
      {loading ? "…" : "Revoke"}
    </button>
  );
}
