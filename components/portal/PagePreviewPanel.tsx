"use client";

import type { PageCreationSuggestion } from "@/lib/supabase";

// ── Image placeholder ─────────────────────────────────────────────────────────

function ImagePlaceholder({
  className = "",
  label = "Image",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center bg-slate-100 rounded-lg border border-slate-200 gap-2 ${className}`}>
      <svg className="w-7 h-7 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Page type → accent color ──────────────────────────────────────────────────

const PAGE_ACCENTS: Record<string, { hero: string; heroText: string; btn: string; btnText: string }> = {
  "Location Page":   { hero: "bg-emerald-700",  heroText: "text-white", btn: "bg-white", btnText: "text-emerald-800" },
  "Service Page":    { hero: "bg-blue-700",     heroText: "text-white", btn: "bg-white", btnText: "text-blue-800"    },
  "Industry Page":   { hero: "bg-violet-800",   heroText: "text-white", btn: "bg-white", btnText: "text-violet-900"  },
  "Use-Case Page":   { hero: "bg-amber-700",    heroText: "text-white", btn: "bg-white", btnText: "text-amber-900"   },
  "Job Title Page":  { hero: "bg-indigo-700",   heroText: "text-white", btn: "bg-white", btnText: "text-indigo-900"  },
  "Comparison Page": { hero: "bg-slate-800",    heroText: "text-white", btn: "bg-white", btnText: "text-slate-900"   },
};

function getAccent(type: string) {
  return PAGE_ACCENTS[type] ?? { hero: "bg-slate-800", heroText: "text-white", btn: "bg-white", btnText: "text-slate-900" };
}

// ── Page-type feature cards ───────────────────────────────────────────────────

const FEATURE_SETS: Record<string, Array<{ icon: string; title: string; desc: string }>> = {
  "Location Page": [
    { icon: "📍", title: "Serving Your Area",     desc: "Local expertise and availability for clients in this region." },
    { icon: "⚡", title: "Fast Response",          desc: "Reach us directly — no national call centres." },
    { icon: "⭐", title: "Local Track Record",     desc: "Trusted by clients in this community for years." },
  ],
  "Service Page": [
    { icon: "✓",  title: "Full-Service",           desc: "Everything handled end-to-end, no hidden gaps." },
    { icon: "📈", title: "Proven Results",          desc: "Clear outcomes you can measure from day one." },
    { icon: "🤝", title: "Easy to Get Started",    desc: "Simple onboarding — you'll be up and running quickly." },
  ],
  "Industry Page": [
    { icon: "🏭", title: "Industry Experience",    desc: "Deep familiarity with the specific challenges of this sector." },
    { icon: "🎯", title: "Tailored Approach",      desc: "Not a generic solution — built for this vertical." },
    { icon: "📊", title: "Measurable Impact",      desc: "Defined KPIs and reporting aligned to your business." },
  ],
  "Use-Case Page": [
    { icon: "🔧", title: "Purpose-Built",          desc: "Designed specifically for this workflow, not adapted from another." },
    { icon: "⏱",  title: "Time Saved",             desc: "Reduces the manual work this use case usually demands." },
    { icon: "🔄", title: "Integrates Cleanly",     desc: "Works alongside your existing tools without friction." },
  ],
  "Job Title Page": [
    { icon: "👤", title: "Built for Your Role",    desc: "Designed around how you actually work, not generic tasks." },
    { icon: "🚀", title: "Faster Outcomes",        desc: "Cuts the time between effort and result for this function." },
    { icon: "💡", title: "Clear Visibility",       desc: "The reporting and control your role needs." },
  ],
  "Comparison Page": [
    { icon: "⚖️", title: "Honest Comparison",     desc: "We cover both sides fairly — no spin." },
    { icon: "🎯", title: "Right Fit First",        desc: "Our goal is to help you pick the tool that suits you best." },
    { icon: "📞", title: "Talk It Through",        desc: "Not sure? Our team will help you decide without pressure." },
  ],
};

function getFeatures(type: string) {
  return FEATURE_SETS[type] ?? FEATURE_SETS["Service Page"];
}

// ── Generating state ──────────────────────────────────────────────────────────

function GeneratingState({ s }: { s: PageCreationSuggestion }) {
  const accent = getAccent(s.page_type);
  return (
    <div className="h-full flex flex-col">
      {/* Nav */}
      <div className="border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-white shrink-0">
        <div className="w-24 h-3 bg-slate-200 rounded animate-pulse" />
        <div className="flex gap-4">
          {[1,2,3].map(i => <div key={i} className="w-12 h-2.5 bg-slate-100 rounded animate-pulse" />)}
        </div>
      </div>
      {/* Hero skeleton */}
      <div className={`${accent.hero} opacity-60 px-8 py-12 flex gap-8 shrink-0`}>
        <div className="flex-1 space-y-3">
          <div className="w-20 h-5 bg-white/20 rounded-full" />
          <div className="w-4/5 h-7 bg-white/30 rounded animate-pulse" />
          <div className="w-3/5 h-7 bg-white/20 rounded animate-pulse" />
          <div className="w-full h-4 bg-white/20 rounded mt-4 animate-pulse" />
          <div className="w-4/5 h-4 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="w-48 shrink-0"><ImagePlaceholder className="h-full min-h-[160px] opacity-30" /></div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white">
        <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-[13px] font-medium text-slate-500">Generating page content…</p>
        <p className="text-[12px] text-slate-400">Check back in a minute or two.</p>
      </div>
    </div>
  );
}

// ── Pending suggestion state ──────────────────────────────────────────────────

function SuggestionPreviewState({ s }: { s: PageCreationSuggestion }) {
  const accent = getAccent(s.page_type);
  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Nav */}
      <div className="border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-white shrink-0">
        <div className="w-24 h-3 bg-slate-200 rounded" />
        <div className="flex gap-4">
          {[1,2,3].map(i => <div key={i} className="w-12 h-2.5 bg-slate-100 rounded" />)}
        </div>
      </div>
      {/* Hero */}
      <div className={`${accent.hero} px-8 py-10 flex gap-8 shrink-0`}>
        <div className="flex-1">
          <div className="inline-block text-[10px] font-bold px-2 py-0.5 bg-white/20 text-white rounded-full mb-3 uppercase tracking-wider">
            {s.page_type}
          </div>
          <h2 className={`text-[26px] font-bold ${accent.heroText} leading-tight mb-3`}>{s.page_title}</h2>
          <p className={`text-[14px] ${accent.heroText} opacity-80 mb-5`}>{s.reasoning}</p>
          <div className="h-8 w-28 bg-white/30 rounded-lg" />
        </div>
        <div className="w-48 shrink-0">
          <ImagePlaceholder className="h-full min-h-[150px] opacity-60" label="Hero image" />
        </div>
      </div>
      {/* Slug strip */}
      <div className="bg-slate-50 border-b border-slate-200 px-8 py-2.5 flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">URL</span>
        <span className="font-mono text-[12px] text-slate-600">{s.suggested_slug}</span>
        <span className="ml-auto text-[11px] text-slate-400 italic">Awaiting approval to generate content</span>
      </div>
      {/* Body placeholder */}
      <div className="flex-1 px-8 py-8 space-y-4">
        {[80, 60, 90, 50, 70].map((w, i) => (
          <div key={i} className={`h-3 bg-slate-100 rounded`} style={{ width: `${w}%` }} />
        ))}
        <ImagePlaceholder className="w-full h-36 mt-6" label="Section image" />
        {[65, 80, 55, 75].map((w, i) => (
          <div key={i} className={`h-3 bg-slate-100 rounded`} style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ── Full page preview ─────────────────────────────────────────────────────────

function FullPagePreview({
  s,
  companyName,
  onApprove,
  approving,
  isApproved,
}: {
  s: PageCreationSuggestion;
  companyName: string;
  onApprove?: () => void;
  approving?: boolean;
  isApproved?: boolean;
}) {
  const accent = getAccent(s.page_type);
  const features = getFeatures(s.page_type);

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-white">
      {/* Nav */}
      <div className="sticky top-0 z-10 border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-white/95 backdrop-blur-sm shrink-0">
        <span className="text-[14px] font-bold text-slate-900">{companyName}</span>
        <div className="flex items-center gap-5">
          <span className="text-[12px] text-slate-500">Services</span>
          <span className="text-[12px] text-slate-500">About</span>
          <span className="text-[12px] text-slate-500">Contact</span>
          <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${accent.hero} ${accent.heroText}`}>Book Now</span>
        </div>
      </div>

      {/* Hero — 2 col */}
      <div className={`${accent.hero} px-8 py-12 shrink-0`}>
        <div className="flex gap-8 items-center max-w-full">
          <div className="flex-1 min-w-0">
            <div className={`inline-block text-[10px] font-bold px-2.5 py-1 bg-white/20 ${accent.heroText} rounded-full mb-4 uppercase tracking-wider`}>
              {s.page_type}
            </div>
            <h1 className={`text-[28px] font-bold ${accent.heroText} leading-tight mb-3`}>
              {s.generated_h1 || s.page_title}
            </h1>
            {s.generated_meta_description && (
              <p className={`text-[14px] ${accent.heroText} opacity-90 leading-relaxed mb-6 max-w-md`}>
                {s.generated_meta_description}
              </p>
            )}
            <button className={`px-5 py-2.5 rounded-lg text-[13px] font-semibold ${accent.btn} ${accent.btnText}`}>
              Get Started
            </button>
          </div>
          <div className="shrink-0 w-52">
            <ImagePlaceholder className="h-48 w-full" label="Hero image" />
          </div>
        </div>
      </div>

      {/* SEO strip for editors */}
      {(s.generated_meta_title || s.generated_meta_description) && (
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-2.5 flex items-start gap-6 shrink-0">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Meta Title</p>
            <p className="text-[12px] text-slate-600 truncate">{s.generated_meta_title}</p>
          </div>
          <div className="min-w-0 flex-1 border-l border-slate-200 pl-6">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Meta Description</p>
            <p className="text-[12px] text-slate-600 line-clamp-1">{s.generated_meta_description}</p>
          </div>
          {s.generated_word_count && (
            <div className="shrink-0 border-l border-slate-200 pl-6">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Words</p>
              <p className="text-[12px] font-semibold text-slate-700">{s.generated_word_count.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      {/* Body content */}
      {s.generated_body ? (
        <div className="px-8 py-8 flex-1">
          {/* Rendered content with image injected at midpoint */}
          <BodyWithImageInjected html={s.generated_body} />

          {/* Feature grid */}
          <div className="mt-12 pt-10 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-6 text-center">Why choose us</p>
            <div className="grid grid-cols-3 gap-4">
              {features.map((f, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                  <div className="text-[22px] mb-2">{f.icon}</div>
                  <p className="text-[13px] font-semibold text-slate-800 mb-1">{f.title}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 px-8 py-10 space-y-3">
          {[80, 60, 90, 50, 70, 85, 55].map((w, i) => (
            <div key={i} className="h-3 bg-slate-100 rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {/* CTA band */}
      <div className={`${accent.hero} px-8 py-10 text-center shrink-0`}>
        <p className={`text-[20px] font-bold ${accent.heroText} mb-2`}>Ready to get started?</p>
        <p className={`text-[13px] ${accent.heroText} opacity-80 mb-5`}>Reach out and we'll respond within one business day.</p>
        <button className={`px-6 py-2.5 rounded-lg text-[13px] font-semibold ${accent.btn} ${accent.btnText}`}>
          Contact us
        </button>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-8 py-5 flex items-center justify-between bg-white shrink-0">
        <span className="text-[12px] font-semibold text-slate-600">{companyName}</span>
        <p className="text-[11px] text-slate-400">© {new Date().getFullYear()} {companyName}</p>
      </div>

      {/* Approve bar — sticky at bottom if not yet approved */}
      {onApprove && !isApproved && (
        <div className="sticky bottom-0 bg-white border-t border-indigo-200 px-8 py-3 flex items-center gap-3 shrink-0">
          <p className="text-[12px] text-slate-500 flex-1">Happy with this page? Approve it to send for publishing.</p>
          <button
            onClick={onApprove}
            disabled={approving}
            className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {approving ? "Approving…" : "Approve for Publishing"}
          </button>
        </div>
      )}
      {isApproved && (
        <div className="sticky bottom-0 bg-emerald-50 border-t border-emerald-200 px-8 py-3 flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <p className="text-[12px] font-medium text-emerald-700">Approved — this page is queued for publishing.</p>
        </div>
      )}
    </div>
  );
}

// ── Body with image injected at midpoint ──────────────────────────────────────

function BodyWithImageInjected({ html }: { html: string }) {
  // Find the split point: after the second </h2> block
  const h2Matches = [...html.matchAll(/<\/h2>/gi)];
  const splitIdx = h2Matches.length >= 2
    ? h2Matches[1].index! + h2Matches[1][0].length
    : Math.floor(html.length * 0.45);

  const firstHalf = html.slice(0, splitIdx);
  const secondHalf = html.slice(splitIdx);

  return (
    <div
      className="
        text-[14px] text-slate-700 leading-[1.8]
        [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:leading-tight
        [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-5 [&_h3]:mb-2
        [&_p]:mb-4 [&_p]:leading-[1.8]
        [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2
        [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-2
        [&_li]:text-[14px] [&_li]:leading-[1.65]
        [&_strong]:font-semibold [&_strong]:text-slate-900
      "
    >
      <div dangerouslySetInnerHTML={{ __html: firstHalf }} />
      <ImagePlaceholder className="w-full h-44 my-8" label="Section image" />
      <div dangerouslySetInnerHTML={{ __html: secondHalf }} />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PagePreviewPanel({
  suggestion,
  companyName,
  onApprove,
  approving,
}: {
  suggestion: PageCreationSuggestion | null;
  companyName: string;
  onApprove?: () => void;
  approving?: boolean;
}) {
  if (!suggestion) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
        <svg className="w-10 h-10 text-slate-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        <p className="text-[13px] text-slate-400">Select a page to preview</p>
      </div>
    );
  }

  if (suggestion.status === "generating") {
    return <GeneratingState s={suggestion} />;
  }

  if (suggestion.status === "suggested") {
    return <SuggestionPreviewState s={suggestion} />;
  }

  const isApproved = suggestion.status === "approved_for_publish" || suggestion.status === "published";

  return (
    <FullPagePreview
      s={suggestion}
      companyName={companyName}
      onApprove={isApproved ? undefined : onApprove}
      approving={approving}
      isApproved={isApproved}
    />
  );
}
