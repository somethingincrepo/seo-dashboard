"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface PortalSidebarProps {
  children: React.ReactNode;
  companyName: string;
  token: string;
  pendingCount: number;
  categoryBreakdown: Record<string, number>;
}

const CATEGORY_ROUTES: Record<string, string> = {
  Technical: "technical",
  "On-Page": "on-page",
  Content: "content",
  "AI-GEO": "ai-geo",
};

const NAV_ITEMS = [
  { suffix: "", label: "Dashboard", icon: "⬡" },
  { suffix: "/approvals", label: "Approvals", icon: "✦" },
  { suffix: "/reports", label: "Reports", icon: "◈" },
  { suffix: "/activity", label: "Activity", icon: "⚙" },
] as const;

export function PortalSidebar({
  children,
  companyName,
  token,
  pendingCount,
  categoryBreakdown,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const base = `/portal/${token}`;

  const approvalsExpanded = pathname.startsWith(`${base}/approvals`);
  const hasCategoryItems = Object.values(categoryBreakdown).some((n) => n > 0);

  return (
    <div className="flex min-h-screen">
      <aside className="glass fixed left-0 top-0 h-full w-56 z-20 flex flex-col py-6 px-4">
        {/* Brand */}
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600/40 border border-violet-400/30 flex items-center justify-center text-xs font-bold text-violet-300">
              {companyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-white/80 tracking-tight leading-none">{companyName}</div>
              <div className="text-[10px] text-white/30 mt-0.5">Client Portal</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const href = `${base}${item.suffix}`;
            const isActive =
              item.suffix === ""
                ? pathname === base
                : pathname.startsWith(href);

            return (
              <div key={item.suffix}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all border-l-2",
                    isActive
                      ? "bg-white/[0.06] text-white/90 font-medium border-l-violet-400"
                      : "border-l-transparent text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.suffix === "/approvals" && pendingCount > 0 && (
                    <span className="text-[10px] text-amber-300 ml-auto mr-1">
                      {pendingCount} to review
                    </span>
                  )}
                </Link>

                {/* Nested category items under Approvals */}
                {item.suffix === "/approvals" && (approvalsExpanded || hasCategoryItems) && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {Object.entries(CATEGORY_ROUTES).map(([cat, slug]) => {
                      const count = categoryBreakdown[cat] || 0;
                      const catHref = `${base}/approvals/${slug}`;
                      const catActive = pathname === catHref;
                      if (count === 0 && !catActive) return null;
                      return (
                        <Link
                          key={slug}
                          href={catHref}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all",
                            catActive
                              ? "text-white/90 bg-white/[0.06] font-medium"
                              : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
                          )}
                        >
                          <span className="flex-1">{cat}</span>
                          <span className="text-white/25">{count}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom — Book a meeting */}
        <div className="border-t border-white/[0.08] pt-4 px-2">
          <a
            href="https://calendly.com/somethinginc/something-inc-touchbase-1"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm transition-all text-white/40 hover:text-white/70 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12]"
          >
            <span className="text-base">🗓</span>
            <span>Book a meeting</span>
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 p-10">{children}</main>
    </div>
  );
}
