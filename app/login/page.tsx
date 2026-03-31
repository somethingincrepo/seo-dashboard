import { login } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-10 w-full max-w-sm text-center">
        <div className="mb-8">
          <div className="text-3xl font-semibold tracking-tight mb-1">Something Inc.</div>
          <div className="text-white/40 text-sm">SEO Dashboard</div>
        </div>

        <form action={login} className="space-y-4">
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-white/35 focus:bg-white/12 transition-all"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-violet-600/70 hover:bg-violet-500/80 border border-violet-400/30 font-medium transition-all text-white"
          >
            Sign in
          </button>
        </form>

        {error && (
          <p className="mt-4 text-red-400 text-sm">Incorrect password.</p>
        )}
      </div>
    </div>
  );
}
