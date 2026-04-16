"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EngainProject } from "@/lib/engain";

interface EngainLinkButtonProps {
  clientId: string;
  currentProjectId?: string;
  currentProjectName?: string;
}

export function EngainLinkButton({
  clientId,
  currentProjectId,
  currentProjectName,
}: EngainLinkButtonProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<EngainProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function openPicker() {
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch("/api/engain/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function linkProject(projectId: string | null) {
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}/engain-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engain_project_id: projectId }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={openPicker}
        className="px-4 py-2 rounded-xl text-sm border transition-all bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"
      >
        {currentProjectId ? "Change Project" : "Link Project"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-w-[220px]">
      {loading ? (
        <div className="text-xs text-slate-400 py-2">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="text-xs text-slate-400 py-2">No projects found</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {projects.map((p) => (
            <button
              key={p.id}
              disabled={saving}
              onClick={() => linkProject(p.id)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                p.id === currentProjectId ? "text-orange-600 font-medium" : "text-slate-700"
              }`}
            >
              {p.name}
              {p.id === currentProjectId && (
                <span className="ml-2 text-[10px] text-orange-400">current</span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {currentProjectId && (
          <button
            disabled={saving}
            onClick={() => linkProject(null)}
            className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1"
          >
            Unlink
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
