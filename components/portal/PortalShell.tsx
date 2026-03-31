"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface PortalShellProps {
  children: React.ReactNode;
  companyName: string;
  token: string;
  pendingCount: number;
}

export function PortalShell({ children, companyName, token, pendingCount }: PortalShellProps) {
  const pathname = usePathname();
  const base = `/portal/${token}`;

  const nav = [
    { href: base, label: "Dashboard" },
    { href: `${base}/approvals`, label: "Approvals", count: pendingCount },
    { href: `${base}/reports`, label: "Reports" },
    { href: `${base}/activity`, label: "Activity" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-20 px-6 py-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-600/40 border border-violet-400/30 flex items-center justify-center text-xs font-bold text-violet-300">
              {companyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-white/90 leading-none">{companyName}</div>
              <div className="text-[10px] text-white/30 mt-0.5">SEO Portal</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {nav.map((item) => {
              const isActive = item.href === base
                ? pathname === base
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5",
                    isActive
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  )}
                >
                  {item.label}
                  {item.count != null && item.count > 0 && (
                    <span className="bg-amber-500/30 border border-amber-400/30 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  );
}
