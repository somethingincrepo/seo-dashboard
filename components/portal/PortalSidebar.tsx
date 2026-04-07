"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface PortalSidebarProps {
  children: React.ReactNode;
  companyName: string;
  token: string;
  pendingCount: number;
  contentReviewCount: number;
  categoryBreakdown: Record<string, number>;
}

const CATEGORY_ROUTES: Record<string, string> = {
  Technical: "technical",
  "On-Page": "on-page",
  "AI-GEO": "ai-geo",
};

const NAV_ITEMS = [
  { suffix: "", label: "Dashboard", icon: "⬡" },
  { suffix: "/approvals", label: "Approvals", icon: "✦" },
  { suffix: "/content", label: "Content", icon: "◆" },
  { suffix: "/reports", label: "Reports", icon: "◈" },
  { suffix: "/activity", label: "Activity", icon: "◎" },
] as const;

export function PortalSidebar({
  children,
  companyName,
  token,
  pendingCount,
  contentReviewCount,
  categoryBreakdown,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const base = `/portal/${token}`;

  const approvalsExpanded = pathname.startsWith(`${base}/approvals`);
  const contentExpanded = pathname.startsWith(`${base}/content`);
  const hasCategoryItems = Object.values(categoryBreakdown).some((n) => n > 0);

  return (
    <div className="flex min-h-screen">
      <aside className="glass fixed left-0 top-0 h-full w-56 z-20 flex flex-col py-6 px-4 border-r border-slate-200/60">
        {/* Brand */}
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
              {companyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 tracking-tight leading-none">{companyName}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Client Portal</div>
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border-l-2",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 border-l-indigo-500"
                      : "border-l-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/80"
                  )}
                >
                  <span className="text-[15px] leading-none">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.suffix === "/approvals" && pendingCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 ml-auto mr-1 tabular">
                      {pendingCount}
                    </span>
                  )}
                  {item.suffix === "/content" && contentReviewCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 ml-auto mr-1 tabular">
                      {contentReviewCount}
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
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-150",
                            catActive
                              ? "text-indigo-700 bg-indigo-50 font-medium"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                          )}
                        >
                          <span className="flex-1">{cat}</span>
                          <span className="text-slate-400 tabular">{count}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Nested sub-items under Content */}
                {item.suffix === "/content" && contentExpanded && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {[
                      { label: "Pipeline", href: `${base}/content` },
                      { label: "Keywords", href: `${base}/content/keywords` },
                    ].map(({ label, href }) => {
                      const isActive = label === "Pipeline"
                        ? pathname === `${base}/content`
                        : pathname.startsWith(href);
                      return (
                        <Link
                          key={label}
                          href={href}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-150",
                            isActive
                              ? "text-indigo-700 bg-indigo-50 font-medium"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                          )}
                        >
                          {label}
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
        <div className="border-t border-slate-200 pt-4 px-2">
          <a
            href="https://calendly.com/somethinginc/something-inc-touchbase-1"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm transition-all duration-150 text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100"
          >
            <span className="text-base">🗓</span>
            <span>Book a meeting</span>
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col ml-56 p-10">{children}</main>
    </div>
  );
}
