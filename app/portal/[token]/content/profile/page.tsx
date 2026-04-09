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

const SECTIONS: {
  key: keyof ContentProfile;
  label: string;
  description: string;
  accentBorder: string; // left-border color class
  dotColor: string;     // sidebar dot
}[] = [
  {
    key: "brand_voice",
    label: "Brand Voice",
    description: "Tone, personality, and how you communicate with patients",
    accentBorder: "border-l-violet-400",
    dotColor: "bg-violet-400",
  },
  {
    key: "style_rules",
    label: "Style Rules",
    description: "Writing conventions applied to every piece of content",
    accentBorder: "border-l-blue-400",
    dotColor: "bg-blue-400",
  },
  {
    key: "formatting_rules",
    label: "Formatting",
    description: "Structure, length, and layout guidelines",
    accentBorder: "border-l-sky-400",
    dotColor: "bg-sky-400",
  },
  {
    key: "core_services",
    label: "Core Services",
    description: "Products and services to highlight in content",
    accentBorder: "border-l-emerald-400",
    dotColor: "bg-emerald-400",
  },
  {
    key: "positioning",
    label: "Positioning",
    description: "What makes you different from competitors",
    accentBorder: "border-l-amber-400",
    dotColor: "bg-amber-400",
  },
  {
    key: "primary_ctas",
    label: "Primary CTAs",
    description: "Calls to action used in content",
    accentBorder: "border-l-orange-400",
    dotColor: "bg-orange-400",
  },
  {
    key: "restricted_language",
    label: "Restricted Language",
    description: "Claims and phrases to never use",
    accentBorder: "border-l-red-400",
    dotColor: "bg-red-400",
  },
  {
    key: "priority_pages",
    label: "Priority Pages",
    description: "Internal pages to link to frequently",
    accentBorder: "border-l-slate-300",
    dotColor: "bg-slate-300",
  },
];

function RichContent({ text }: { text: string }) {
  if (!text?.trim()) {
    return (
      <p className="text-sm text-slate-300 italic">Not set — click Edit to add</p>
    );
  }

  const lines = text.split("\n");
  const blocks: { type: "bullet" | "text"; content: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      blocks.push({ type: "bullet", content: trimmed.slice(2) });
    } else {
      blocks.push({ type: "text", content: line });
    }
  }

  const rendered: React.ReactNode[] = [];
  let bulletGroup: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletGroup.length) {
      rendered.push(
        <ul key={key++} className="space-y-1.5 my-2">
          {bulletGroup.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px] text-slate-700 leading-relaxed">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      );
      bulletGroup = [];
    }
  };

  for (const block of blocks) {
    if (block.type === "bullet") {
      bulletGroup.push(block.content);
    } else {
      flushBullets();
      if (block.content.trim()) {
        rendered.push(
          <p key={key++} className="text-[14px] text-slate-700 leading-relaxed">
            {block.content}
          </p>
        );
      } else {
        rendered.push(<div key={key++} className="h-2" />);
      }
    }
  }
  flushBullets();

  return <div className="space-y-1">{rendered}</div>;
}

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
  const isEmpty = !value?.trim();

  return (
    <div
      id={section.key}
      className={`scroll-mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden border-l-4 ${section.accentBorder} ${editing ? "ring-1 ring-slate-300" : ""}`}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-semibold text-slate-900 leading-tight">{section.label}</h3>
          <p className="text-[13px] text-slate-400 mt-0.5">{section.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-6 mt-0.5">
          {saved && (
            <span className="text-[11px] font-medium text-green-600">Saved ✓</span>
          )}
          {!editing ? (
            <button
              onClick={handleEdit}
              className="text-[12px] font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              {isEmpty ? "Add" : "Edit"}
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="text-[12px] text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="text-[12px] font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 mx-5" />

      {/* Content */}
      <div className="px-5 py-4">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(4, draft.split("\n").length + 1)}
            placeholder={`Enter ${section.label.toLowerCase()}…`}
            className="w-full text-[13px] text-slate-800 leading-relaxed border border-slate-300 rounded-lg px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono bg-slate-50"
          />
        ) : (
          <RichContent text={value} />
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
    const el = document.getElementById(key);
    if (!el) return;
    // Offset scroll so sticky headers don't overlap
    const top = el.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    if (!profile) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-10% 0px -40% 0px" }
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

  const filledCount = SECTIONS.filter((s) => profile[s.key]?.trim()).length;

  return (
    <div className="flex gap-8 min-h-full">
      {/* Left nav */}
      <div className="w-48 shrink-0 hidden lg:block">
        <div className="sticky top-8">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 px-2">Sections</p>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => {
              const hasContent = !!profile[s.key]?.trim();
              const isActive = activeSection === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => scrollTo(s.key)}
                  className={`text-left px-3 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-2.5 ${
                    isActive
                      ? "bg-slate-100 text-slate-900 font-semibold"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${hasContent ? s.dotColor : "bg-slate-200"}`} />
                  {s.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-5 px-3">
            <p className="text-[11px] text-slate-400">
              <span className="font-semibold text-slate-600">{filledCount}</span> of {SECTIONS.length} sections filled
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Content Profile</h1>
          <p className="text-base text-slate-500 mt-1">
            Brand voice and guidelines used when writing content for your site.
          </p>
        </div>

        <div className="flex flex-col gap-5">
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
