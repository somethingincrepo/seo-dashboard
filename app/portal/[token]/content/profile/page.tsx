"use client";

import { useEffect, useState } from "react";
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

function ProfileSection({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</h3>
      <p className="text-[14px] text-slate-700 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

export default function ContentProfilePage() {
  const params = useParams();
  const token = params.token as string;

  const [profile, setProfile] = useState<ContentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/portal/content-profile?token=${token}`)
      .then((r) => r.json())
      .then((data: { profile: ContentProfile | null }) => {
        setProfile(data.profile);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Error loading profile");
        setLoading(false);
      });
  }, [token]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Content Profile</h1>
        <p className="text-base text-slate-500 mt-1">
          Brand voice, style rules, and content guidelines used when generating articles for your site.
        </p>
      </div>

      {loading && <div className="text-slate-400 text-sm">Loading…</div>}

      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>
      )}

      {!loading && !error && !profile && (
        <div className="text-center py-16">
          <div className="text-3xl mb-4 text-slate-300">◆</div>
          <div className="font-medium text-slate-500 mb-2">Content profile not set up yet</div>
          <div className="text-sm text-slate-400 max-w-xs mx-auto">
            Your content profile is generated during onboarding. Reach out if you think this should be populated.
          </div>
        </div>
      )}

      {profile && (
        <div className="flex flex-col gap-4">
          <ProfileSection label="Brand Voice" value={profile.brand_voice} />
          <ProfileSection label="Style Rules" value={profile.style_rules} />
          <ProfileSection label="Formatting Rules" value={profile.formatting_rules} />
          <ProfileSection label="Core Products & Services" value={profile.core_services} />
          <ProfileSection label="Positioning & Differentiators" value={profile.positioning} />
          <ProfileSection label="Primary CTAs" value={profile.primary_ctas} />
          <ProfileSection label="Restricted Language" value={profile.restricted_language} />
          <ProfileSection label="Priority Internal Pages" value={profile.priority_pages} />
        </div>
      )}
    </div>
  );
}
