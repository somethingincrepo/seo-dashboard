"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  BarChart3,
  Activity,
  Calendar,
} from "lucide-react";

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
  { suffix: "",          label: "Dashboard", Icon: LayoutDashboard },
  { suffix: "/approvals",label: "Approvals", Icon: CheckSquare },
  { suffix: "/content",  label: "Content",   Icon: FileText },
  { suffix: "/reports",  label: "Reports",   Icon: BarChart3 },
  { suffix: "/activity", label: "Activity",  Icon: Activity },
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
      <aside className="fixed left-0 top-0 h-full w-[240px] z-20 flex flex-col bg-white border-r border-slate-200/80">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {companyName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-semibold text-slate-900 leading-tight truncate">{companyName}</span>
              <span className="text-[11px] text-slate-500 leading-tight">Client Portal</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const href = `${base}${item.suffix}`;
            const isActive =
              item.suffix === ""
                ? pathname === base
                : pathname.startsWith(href);
            const { Icon } = item;

            return (
              <div key={item.suffix}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-slate-700" : "text-slate-500")} />
                    <span>{item.label}</span>
                  </div>
                  {item.suffix === "/approvals" && pendingCount > 0 && (
                    <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/60">
                      {pendingCount}
                    </span>
                  )}
                  {item.suffix === "/content" && contentReviewCount > 0 && (
                    <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/60">
                      {contentReviewCount}
                    </span>
                  )}
                </Link>

                {/* Approvals sub-nav */}
                {item.suffix === "/approvals" && (approvalsExpanded || hasCategoryItems) && (
                  <div className="ml-[18px] pl-3 border-l border-slate-200 mt-0.5 space-y-0.5">
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
                            "flex items-center justify-between px-2 py-1 rounded text-[12px] transition-colors",
                            catActive
                              ? "text-slate-900 font-medium bg-slate-50"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          )}
                        >
                          <span>{cat}</span>
                          <span className="tabular text-slate-400 text-[11px]">{count}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Content sub-nav */}
                {item.suffix === "/content" && contentExpanded && (
                  <div className="ml-[18px] pl-3 border-l border-slate-200 mt-0.5 space-y-0.5">
                    {[
                      { label: "Pipeline", href: `${base}/content` },
                      { label: "Keywords", href: `${base}/content/keywords` },
                    ].map(({ label, href }) => {
                      const subActive = label === "Pipeline"
                        ? pathname === `${base}/content`
                        : pathname.startsWith(href);
                      return (
                        <Link
                          key={label}
                          href={href}
                          className={cn(
                            "flex items-center px-2 py-1 rounded text-[12px] transition-colors",
                            subActive
                              ? "text-slate-900 font-medium bg-slate-50"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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

        {/* Bottom CTA */}
        <div className="px-3 py-3 border-t border-slate-100">
          <a
            href="https://calendly.com/somethinginc/something-inc-touchbase-1"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-[0_1px_2px_0_rgba(16,24,40,0.04)]"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            Book a meeting
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col ml-[240px] p-10 min-h-screen">{children}</main>
    </div>
  );
}
