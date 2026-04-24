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
      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 border border-indigo-500 font-medium transition-all text-white disabled:opacity-60"
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const error = searchParams.get("error");

  return (
    <form action={login} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      <input
        type="text"
        name="username"
        placeholder="Username"
        required
        autoFocus
        autoComplete="username"
        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        required
        autoComplete="current-password"
        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
      />
      <SubmitButton />
      {error && (
        <p className="mt-4 text-red-400 text-sm">Incorrect username or password.</p>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-10 w-full max-w-sm text-center">
        <div className="mb-8">
          <div className="text-3xl font-semibold tracking-tight mb-1">Something Inc.</div>
          <div className="text-slate-500 text-sm">SEO Dashboard</div>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
