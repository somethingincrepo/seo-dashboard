import { listActiveSessions, listLoginEvents } from "@/lib/portal-auth";
import { GlassCard } from "@/components/ui/GlassCard";
import { RevokeSessionButton } from "./_components/RevokeSessionButton";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortUA(ua: string | null): string {
  if (!ua) return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 30);
}

export default async function SessionsPage() {
  const [sessions, events] = await Promise.all([
    listActiveSessions(),
    listLoginEvents(100),
  ]);

  const failedEvents = events.filter((e) => !e.success);
  const successEvents = events.filter((e) => e.success);

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sessions &amp; Login Activity</h1>
        <p className="text-sm text-slate-500 mt-1">
          Active portal sessions and login history across all clients.
        </p>
      </div>

      {/* Active Sessions */}
      <GlassCard className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Active Portal Sessions</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            {sessions.length} active
          </span>
        </div>
        {sessions.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">No active sessions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="text-left px-6 py-3 font-medium">Username</th>
                  <th className="text-left px-6 py-3 font-medium">Client ID</th>
                  <th className="text-left px-6 py-3 font-medium">Last Seen</th>
                  <th className="text-left px-6 py-3 font-medium">Created</th>
                  <th className="text-left px-6 py-3 font-medium">Expires</th>
                  <th className="text-left px-6 py-3 font-medium">Browser</th>
                  <th className="text-left px-6 py-3 font-medium">IP</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono text-xs text-slate-800">{s.username}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{s.client_id.slice(0, 12)}…</td>
                    <td className="px-6 py-3 text-slate-600">{relativeTime(s.last_seen_at)}</td>
                    <td className="px-6 py-3 text-slate-500 text-xs">{formatDate(s.created_at)}</td>
                    <td className="px-6 py-3 text-slate-500 text-xs">{formatDate(s.expires_at)}</td>
                    <td className="px-6 py-3 text-slate-500 text-xs">{shortUA(s.user_agent)}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">{s.ip ?? "—"}</td>
                    <td className="px-6 py-3 text-right">
                      <RevokeSessionButton sessionId={s.id} username={s.username} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Login Events */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <div className="text-xs font-medium text-slate-500 mb-1">Successful Logins (last 100)</div>
          <div className="text-2xl font-bold text-emerald-600">{successEvents.length}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs font-medium text-slate-500 mb-1">Failed Attempts (last 100)</div>
          <div className="text-2xl font-bold text-red-500">{failedEvents.length}</div>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Login History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left px-6 py-3 font-medium">When</th>
                <th className="text-left px-6 py-3 font-medium">Username</th>
                <th className="text-left px-6 py-3 font-medium">Type</th>
                <th className="text-left px-6 py-3 font-medium">Result</th>
                <th className="text-left px-6 py-3 font-medium">Reason</th>
                <th className="text-left px-6 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-6 py-2 text-xs text-slate-400">{relativeTime(e.created_at)}</td>
                  <td className="px-6 py-2 font-mono text-xs text-slate-700">{e.username}</td>
                  <td className="px-6 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      e.user_type === "admin"
                        ? "bg-violet-50 text-violet-600"
                        : "bg-sky-50 text-sky-600"
                    }`}>
                      {e.user_type}
                    </span>
                  </td>
                  <td className="px-6 py-2">
                    <span className={`text-xs font-medium ${e.success ? "text-emerald-600" : "text-red-500"}`}>
                      {e.success ? "✓ success" : "✗ failed"}
                    </span>
                  </td>
                  <td className="px-6 py-2 text-xs text-slate-400">{e.failure_reason ?? "—"}</td>
                  <td className="px-6 py-2 font-mono text-xs text-slate-400">{e.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
