import Link from "next/link";
import { logout } from "@/app/actions/auth";

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: "/", label: "Overview", icon: "⬡" },
      { href: "/clients", label: "Clients", icon: "◈" },
      { href: "/tokens", label: "Add Client", icon: "⊕" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/activity", label: "Activity", icon: "✦" },
      { href: "/audit", label: "Audits", icon: "⌖" },
      { href: "/design-review", label: "Design Review", icon: "◎" },
      { href: "/reddit", label: "Reddit", icon: "▲" },
      { href: "/indexing", label: "Indexing", icon: "⊙" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/token-usage", label: "Token Usage", icon: "◈" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/users", label: "Users", icon: "◉" },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="glass fixed left-0 top-0 h-full w-56 z-20 flex flex-col py-6 px-4">
      <div className="mb-6 px-2">
        <div className="text-sm font-semibold text-slate-900 tracking-tight">Something Inc.</div>
        <div className="text-xs text-slate-400">SEO Dashboard</div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <form action={logout}>
        <button
          type="submit"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
        >
          <span>↪</span> Sign out
        </button>
      </form>
    </aside>
  );
}
