"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteClientButtonProps {
  clientId: string;
  clientName: string;
}

export function DeleteClientButton({ clientId, clientName }: DeleteClientButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${clientName}"?\n\nThis will permanently remove the client and all their Changes, Jobs, and reports from Airtable and Supabase. This cannot be undone.`
      )
    )
      return;

    // Second confirmation for safety
    const typed = window.prompt(`Type the client name to confirm:\n\n${clientName}`);
    if (typed?.trim() !== clientName.trim()) {
      alert("Name did not match — delete cancelled.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/delete`, { method: "POST" });
      if (res.ok) {
        router.push("/clients");
      } else {
        const data = await res.json();
        alert(`Delete failed: ${data.error ?? "Unknown error"}`);
      }
    } catch {
      alert("Delete failed — network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="px-3 py-1.5 rounded-xl text-sm border transition-all disabled:opacity-40 bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
    >
      {loading ? "Deleting…" : "Delete Client"}
    </button>
  );
}
