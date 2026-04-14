import { portalLogin } from "@/app/actions/portal-auth";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-10 w-full max-w-sm text-center">
        <div className="mb-8">
          <div className="text-3xl font-semibold tracking-tight mb-1">Client Portal</div>
          <div className="text-slate-500 text-sm">Sign in to your account</div>
        </div>

        <form action={portalLogin} className="space-y-4">
          <input
            type="text"
            name="username"
            placeholder="Username"
            required
            autoComplete="username"
            autoFocus
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
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 border border-indigo-500 font-medium transition-all text-white"
          >
            Sign in
          </button>
        </form>

        {error === "rate_limited" && (
          <p className="mt-4 text-red-400 text-sm">
            Too many attempts. Please wait 15 minutes and try again.
          </p>
        )}
        {error === "1" && (
          <p className="mt-4 text-red-400 text-sm">
            Incorrect username or password.
          </p>
        )}
      </div>
    </div>
  );
}
