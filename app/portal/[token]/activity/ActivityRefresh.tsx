"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Silently re-fetches the server component every 30 s so the changelog stays current. */
export function ActivityRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
