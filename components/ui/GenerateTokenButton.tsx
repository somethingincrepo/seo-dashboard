"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface GenerateTokenButtonProps {
  clientId: string;
  hasToken: boolean;
}

export function GenerateTokenButton({ clientId, hasToken }: GenerateTokenButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    if (hasToken && !confirm("This will replace the existing portal token. The old link will stop working. Continue?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/generate-token`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="px-4 py-2 rounded-xl text-sm border transition-all disabled:opacity-40 bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
    >
      {loading ? "Generating…" : hasToken ? "Regenerate" : "Generate Token"}
    </button>
  );
}
