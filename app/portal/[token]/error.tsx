"use client";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass rounded-2xl p-8 max-w-md text-center">
        <div className="text-2xl mb-2">⚠</div>
        <div className="font-medium mb-2">Something went wrong</div>
        <div className="text-white/40 text-sm mb-4">{error.message}</div>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-violet-600/70 border border-violet-400/30 text-sm hover:bg-violet-500/80 transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
