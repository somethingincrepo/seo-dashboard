"use client";

import { ApprovalProgressProvider } from "@/components/portal/ApprovalProgress";

export function ApprovalsProvider({ total, children }: { total: number; children: React.ReactNode }) {
  return <ApprovalProgressProvider total={total}>{children}</ApprovalProgressProvider>;
}
