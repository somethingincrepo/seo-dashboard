"use client";

interface GscGuideProps {
  token: string;
  /** "error" — property saved but API denied. YES path skips the property entry step.
   *  "setup" — no property saved. YES path includes entering the property in Settings. */
  mode: "error" | "setup";
}

function Step({ n, children, muted }: { n: number; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
        muted ? "bg-slate-200 text-slate-500" : "bg-indigo-600 text-white"
      }`}>{n}</span>
      <span className="text-sm text-slate-700 leading-snug">{children}</span>
    </div>
  );
}

export function GscGuide({ token, mode }: GscGuideProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">
        Do you have Google Search Console set up for this site?
      </p>

      {/* NO — set it up first */}
      <div className="rounded-xl border-2 border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <span className="text-[11px] font-bold tracking-widest text-slate-500">NO — SET IT UP FIRST</span>
        </div>
        <div className="divide-y divide-slate-100">
          <Step n={1}>
            Go to{" "}
            <a href="https://search.google.com/search-console/welcome" target="_blank" rel="noreferrer"
              className="text-indigo-600 font-medium hover:underline underline-offset-2">
              Google Search Console ↗
            </a>{" "}
            and sign in with your Google account
          </Step>
          <Step n={2}>
            Click <strong className="text-slate-900">Add property</strong>, enter your site URL, and complete Google&apos;s verification (5–10 min)
          </Step>
          <Step n={3} muted>
            Once verified, follow the <em>Yes</em> steps below
          </Step>
        </div>
      </div>

      {/* YES — connect it now */}
      <div className="rounded-xl border-2 border-indigo-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-indigo-600 border-b border-indigo-700">
          <span className="text-[11px] font-bold tracking-widest text-indigo-100">YES — CONNECT IT NOW</span>
        </div>
        <div className="divide-y divide-slate-100">
          <Step n={1}>
            Open{" "}
            <a href="https://search.google.com/search-console/users" target="_blank" rel="noreferrer"
              className="text-indigo-600 font-medium hover:underline underline-offset-2">
              Search Console → Settings → Users and permissions ↗
            </a>
            , click <strong className="text-slate-900">Add user</strong>, enter{" "}
            <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800">
              reporting@somethingincorporated.io
            </code>{" "}
            with <strong className="text-slate-900">Full</strong> permission, and click <strong className="text-slate-900">Add</strong>
          </Step>
          {mode === "setup" ? (
            <Step n={2}>
              Go to{" "}
              <a href={`/portal/${token}/settings#integrations`}
                className="text-indigo-600 font-medium hover:underline underline-offset-2">
                Settings → Integrations
              </a>{" "}
              and enter your GSC property — e.g.{" "}
              <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800">
                sc-domain:yoursite.com
              </code>
            </Step>
          ) : (
            <Step n={2} muted>
              Come back here — your data will appear within a few minutes
            </Step>
          )}
        </div>
      </div>
    </div>
  );
}
