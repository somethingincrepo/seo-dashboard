"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type ContentProfile = {
  brand_voice: string;
  style_rules: string;
  formatting_rules: string;
  core_services: string;
  positioning: string;
  primary_ctas: string;
  restricted_language: string;
  priority_pages: string;
};

const SECTIONS: { key: keyof ContentProfile; label: string; description: string }[] = [
  { key: "brand_voice", label: "Brand Voice", description: "Tone, personality, and how you communicate with patients" },
  { key: "style_rules", label: "Style Rules", description: "Writing conventions applied to every piece of content" },
  { key: "formatting_rules", label: "Formatting", description: "Structure, length, and layout guidelines" },
  { key: "core_services", label: "Core Services", description: "Products and services to highlight in content" },
  { key: "positioning", label: "Positioning", description: "What makes you different from competitors" },
  { key: "primary_ctas", label: "Primary CTAs", description: "Calls to action used in content" },
  { key: "restricted_language", label: "Restricted Language", description: "Claims and phrases to never use" },
  { key: "priority_pages", label: "Priority Pages", description: "Internal pages to link to frequently" },
];

function ProfileSection({
  section,
  value,
  recordId,
  token,
}: {
  section: typeof SECTIONS[number];
  value: string;
  recordId: string;
  token: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep draft in sync if parent refreshes
  useEffect(() => { setDraft(value); }, [value]);

  const handleEdit = () => {
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/content-profile?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: recordId, field: section.key, value: draft }),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [token, recordId, section.key, draft]);

  const isDirty = draft !== value;

  return (
    <div id={section.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-900">{section.label}</h3>
          <p className="text-[12px] text-slate-400 mt-0.5">{section.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {saved && (
            <span className="text-[11px] font-medium text-green-600">Saved</span>
          )}
          {!editing ? (
            <button
              onClick={handleEdit}
              className="text-[12px] text-slate-500 hover:text-slate-900 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="text-[12px] text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="text-[12px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 px-3 py-1 rounded-lg transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(4, draft.split("\n").length + 1)}
            className="w-full text-[13px] text-slate-800 leading-relaxed border border-slate-300 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-slate-400 font-mono"
          />
        ) : (
          <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">
            {value || <span className="text-slate-300 italic">Not set — click Edit to add</span>}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ContentProfilePage() {
  const params = useParams();
  const token = params.token as string;

  const [profile, setProfile] = useState<ContentProfile | null>(null);
  const [recordId, setRecordId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].key);

  useEffect(() => {
    fetch(`/api/portal/content-profile?token=${token}`)
      .then((r) => r.json())
      .then((data: { profile: ContentProfile | null; record_id?: string }) => {
        setProfile(data.profile);
        if (data.record_id) setRecordId(data.record_id);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Error loading profile");
        setLoading(false);
      });
  }, [token]);

  const scrollTo = (key: string) => {
    setActiveSection(key);
    document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Update active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.key);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [profile]);

  if (loading) return <div className="text-slate-400 text-sm p-8">Loading…</div>;
  if (error) return <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4 m-8">{error}</div>;

  if (!profile) {
    return (
      <div className="text-center py-16">
        <div className="text-3xl mb-4 text-slate-300">◆</div>
        <div className="font-medium text-slate-500 mb-2">Content profile not set up yet</div>
        <div className="text-sm text-slate-400 max-w-xs mx-auto">
          Your content profile is generated during onboarding. Reach out if you think this should be populated.
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-8 min-h-full">
      {/* Left nav */}
      <div className="w-44 shrink-0 hidden lg:block">
        <div className="sticky top-8">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 px-2">Sections</p>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => scrollTo(s.key)}
                className={`text-left px-2 py-1.5 rounded-lg text-[12px] transition-colors ${
                  activeSection === s.key
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Content Profile</h1>
          <p className="text-base text-slate-500 mt-1">
            Brand voice and guidelines used when writing content for your site. Changes save directly to your content pipeline.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {SECTIONS.map((s) => (
            <ProfileSection
              key={s.key}
              section={s}
              value={profile[s.key]}
              recordId={recordId}
              token={token}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
