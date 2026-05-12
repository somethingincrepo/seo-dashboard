"use client";

interface GscGuideProps {
  token: string;
  /** "error"  — property saved but API denied (403). Show the invite fix + from-scratch path.
   *  "setup"  — no property saved yet. Show both paths, YES includes entering the property too. */
  mode: "error" | "setup";
}

function Step({ n, children, muted }: { n: number; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
        muted ? "bg-slate-200 text-slate-500" : "bg-indigo-600 text-white"
      }`}>{n}</span>
      <span className="text-sm text-slate-700">{children}</span>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800">
      {children}
    </code>
  );
}

function Anchor({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="text-indigo-600 font-medium hover:text-indigo-800 hover:underline underline-offset-2"
    >
      {children}
    </a>
  );
}

export function GscGuide({ token, mode }: GscGuideProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700">
        Do you already have Google Search Console set up for this site?
      </p>

      {/* NO — set it up first */}
      <div className="rounded-xl border-2 border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold tracking-widest text-slate-500">
            NO — SET IT UP FIRST
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          <Step n={1}>
            Go to{" "}
            <Anchor href="https://search.google.com/search-console/welcome" external>
              Google Search Console ↗
            </Anchor>{" "}
            and sign in with your Google account
          </Step>
          <Step n={2}>
            Click <strong className="text-slate-900">Add property</strong>, enter your website URL,
            and follow Google&apos;s verification steps — usually 5–10 minutes
          </Step>
          <Step n={3} muted>
            Once verified, come back here and follow the <em>Yes</em> steps below
          </Step>
        </div>
      </div>

      {/* YES — connect it now */}
      <div className="rounded-xl border-2 border-indigo-200 overflow-hidden">
        <div className="px-4 py-3 bg-indigo-600 border-b border-indigo-700">
          <span className="text-xs font-bold tracking-widest text-indigo-100">
            YES — CONNECT IT NOW
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          <Step n={1}>
            Open{" "}
            <Anchor href="https://search.google.com/search-console/users" external>
              Search Console → Settings → Users and permissions ↗
            </Anchor>
            , click <strong className="text-slate-900">Add user</strong>, enter{" "}
            <Code>reporting@somethingincorporated.io</Code> with{" "}
            <strong className="text-slate-900">Full</strong> permission, and click{" "}
            <strong className="text-slate-900">Add</strong>
          </Step>
          {mode === "setup" ? (
            <Step n={2}>
              Go to{" "}
              <Anchor href={`/portal/${token}/settings#integrations`}>
                Settings → Integrations
              </Anchor>{" "}
              and enter your GSC property (e.g.{" "}
              <Code>sc-domain:yoursite.com</Code>)
            </Step>
          ) : (
            <Step n={2} muted>
              Come back here — your data will load within a few minutes
            </Step>
          )}
        </div>
      </div>
    </div>
  );
}
