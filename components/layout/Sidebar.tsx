import Link from "next/link";
import { logout } from "@/app/actions/auth";

const NAV = [
  { href: "/", label: "Overview", icon: "⬡" },
  { href: "/clients", label: "Clients", icon: "◈" },
  { href: "/approvals", label: "Approvals", icon: "✦" },
  { href: "/jobs", label: "Jobs", icon: "⚙" },
];

export function Sidebar() {
  return (
    <aside className="glass fixed left-0 top-0 h-full w-56 z-20 flex flex-col py-6 px-4">
      <div className="mb-8 px-2">
        <div className="text-sm font-semibold text-white/80 tracking-tight">Something Inc.</div>
        <div className="text-xs text-white/30">SEO Dashboard</div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/8 transition-all"
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <form action={logout}>
        <button
          type="submit"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          <span>↪</span> Sign out
        </button>
      </form>
    </aside>
  );
}
