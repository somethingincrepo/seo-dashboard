"use client";

import { useState } from "react";
import { HowToUseModal } from "./HowToUseModal";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
interface PortalSidebarProps {
  children: React.ReactNode;
  companyName: string;
  token: string;
  pendingCount: number;
  contentReviewCount: number;
  titleProposalCount: number;
  categoryBreakdown: Record<string, number>;
}

const CATEGORY_ROUTES: Record<string, string> = {
  Technical: "technical",
  "On-Page": "on-page",
  Content: "content",
  "AI-GEO": "ai-geo",
};

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconApprovals({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
}
function IconContent({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconReports({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}
function IconActivity({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconBook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}

const NAV_ITEMS = [
  { suffix: "",          label: "Dashboard", Icon: IconDashboard },
  { suffix: "/approvals",label: "Approvals", Icon: IconApprovals },
  { suffix: "/content",  label: "Content",   Icon: IconContent },
  { suffix: "/reports",  label: "Reports",   Icon: IconReports },
  { suffix: "/activity", label: "Activity",  Icon: IconActivity },
] as const;

export function PortalSidebar({
  children,
  companyName,
  token,
  pendingCount,
  contentReviewCount,
  titleProposalCount,
  categoryBreakdown,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const base = `/portal/${token}`;
  const [showHowToUse, setShowHowToUse] = useState(false);

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
                  {item.suffix === "/content" && (contentReviewCount > 0 || titleProposalCount > 0) && (
                    <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/60">
                      {contentReviewCount > 0 ? contentReviewCount : titleProposalCount}
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
                      { label: "Pipeline", href: `${base}/content`, badge: 0 },
                      { label: "Title Proposals", href: `${base}/content/titles`, badge: titleProposalCount },
                      { label: "Keywords", href: `${base}/content/keywords`, badge: 0 },
                      { label: "Content Profile", href: `${base}/content/profile`, badge: 0 },
                    ].map(({ label, href, badge }) => {
                      const subActive = label === "Pipeline"
                        ? pathname === `${base}/content`
                        : pathname.startsWith(href);
                      return (
                        <Link
                          key={label}
                          href={href}
                          className={cn(
                            "flex items-center justify-between px-2 py-1 rounded text-[12px] transition-colors",
                            subActive
                              ? "text-slate-900 font-medium bg-slate-50"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          )}
                        >
                          <span>{label}</span>
                          {badge > 0 && (
                            <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/60">
                              {badge}
                            </span>
                          )}
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
        <div className="px-3 py-3 border-t border-slate-100 space-y-2">
          <button
            onClick={() => setShowHowToUse(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
          >
            <IconBook className="w-4 h-4 shrink-0" />
            How to Use
          </button>
          <a
            href="https://calendly.com/somethinginc/something-inc-touchbase-1"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-[0_1px_2px_0_rgba(16,24,40,0.04)]"
          >
            <IconCalendar className="w-4 h-4 shrink-0" />
            Book a meeting
          </a>
        </div>
      </aside>
      {showHowToUse && <HowToUseModal onClose={() => setShowHowToUse(false)} />}

      {/* Main content */}
      <main className="flex-1 flex flex-col ml-[240px] p-10 min-h-screen">{children}</main>
    </div>
  );
}
