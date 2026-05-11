"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { login } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all disabled:opacity-60 shadow-sm cursor-pointer"
    >
      {pending ? "Signing in…" : "Sign in →"}
    </button>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const error = searchParams.get("error");

  return (
    <form action={login} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
          <input
            type="text"
            name="username"
            placeholder="Enter your username"
            required
            autoFocus
            autoComplete="username"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-sm"
          />
        </div>
      </div>
      <SubmitButton />
      {error && (
        <div className="flex items-center gap-2 pt-1">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600">Incorrect username or password.</p>
        </div>
      )}
    </form>
  );
}

const STATS = [
  { label: "Articles shipped", value: "8 / 14", color: "#4ade80" },
  { label: "Pending approvals", value: "3", color: "#fbbf24" },
  { label: "Links implemented", value: "106", color: "#38bdf8" },
  { label: "Pages indexed", value: "94%", color: "#4ade80" },
];

const FEATURES = [
  "Full site audit in month one",
  "Every change approved before it ships",
  "Articles, links, and fixes tracked live",
  "Shareable client portal included",
];

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Left: form ── */}
      <div className="w-full lg:w-[46%] flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12">
        <div className="max-w-sm w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-10">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow"
              style={{ background: "linear-gradient(135deg, #b5e84a, #1eaecb)" }}
            >
              <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xl font-semibold text-slate-900 tracking-tight">Guru</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to your SEO dashboard.</p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-slate-400">
            New client?{" "}
            <a href="/intake" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
              Get started →
            </a>
          </p>
        </div>
      </div>

      {/* ── Right: brand panel ── */}
      <div
        className="hidden lg:flex w-[54%] relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0b1f33 0%, #0c2b40 45%, #0a3d2a 100%)" }}
      >
        {/* Ambient glows */}
        <div
          className="absolute top-1/4 right-1/3 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(110,230,243,0.18) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/3 left-1/4 w-60 h-60 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(181,232,74,0.14) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex flex-col justify-center px-14 py-16 w-full">
          {/* Eyebrow */}
          <div className="text-xs font-semibold tracking-widest uppercase mb-5" style={{ color: "#6ee6f3" }}>
            SEO Automation Platform
          </div>

          {/* Headline */}
          <h2 className="text-[2rem] font-semibold text-white leading-tight mb-4">
            Every SEO decision,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, #6ee6f3, #b5e84a)" }}
            >
              logged and approved.
            </span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-10 max-w-xs">
            Technical audits, content production, internal links — all automated with your sign-off on every change before it touches your site.
          </p>

          {/* Mini dashboard */}
          <div
            className="rounded-2xl p-5 mb-8"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <div className="text-xs font-semibold text-slate-400 tracking-widest uppercase mb-4">This sprint</div>
            <div className="grid grid-cols-2 gap-2.5">
              {STATS.map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div className="text-[1.1rem] font-semibold tabular" style={{ color }}>
                    {value}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(74,222,128,0.15)" }}
                >
                  <svg viewBox="0 0 10 10" fill="none" width="8" height="8">
                    <path d="M2 5l2 2 4-4" stroke="#4ade80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
