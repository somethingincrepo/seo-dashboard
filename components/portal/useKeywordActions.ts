"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export function useKeywordActions(token: string) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const autoClear = useCallback((msg: string, isError?: boolean) => {
    if (isError) setError(msg);
    else setFeedback(msg);
    setTimeout(() => {
      setError(null);
      setFeedback(null);
    }, 2500);
  }, []);

  const addKeyword = useCallback(
    async (keyword: string): Promise<boolean> => {
      setAdding(true);
      setError(null);
      try {
        const res = await fetch("/api/portal/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", token, keyword }),
        });
        const data = await res.json();
        if (!res.ok) {
          autoClear(data.error || "Failed to add keyword", true);
          return false;
        }
        autoClear(`"${keyword}" added${data.enriched ? "" : " (no volume data)"}`);
        router.refresh();
        return true;
      } catch {
        autoClear("Failed to add keyword", true);
        return false;
      } finally {
        setAdding(false);
      }
    },
    [token, router, autoClear]
  );

  const editKeyword = useCallback(
    async (oldKeyword: string, newKeyword: string): Promise<boolean> => {
      setEditing(oldKeyword);
      setError(null);
      try {
        const res = await fetch("/api/portal/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "edit", token, oldKeyword, newKeyword }),
        });
        const data = await res.json();
        if (!res.ok) {
          autoClear(data.error || "Failed to update keyword", true);
          setEditing(null);
          return false;
        }
        autoClear(`Keyword updated`);
        router.refresh();
        setEditing(null);
        return true;
      } catch {
        autoClear("Failed to update keyword", true);
        setEditing(null);
        return false;
      }
    },
    [token, router, autoClear]
  );

  const removeKeyword = useCallback(
    async (keyword: string): Promise<boolean> => {
      setRemoving(keyword);
      setError(null);
      try {
        const res = await fetch("/api/portal/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "remove", token, keyword }),
        });
        const data = await res.json();
        if (!res.ok) {
          autoClear(data.error || "Failed to remove keyword", true);
          setRemoving(null);
          return false;
        }
        autoClear(`"${keyword}" removed`);
        router.refresh();
        setRemoving(null);
        return true;
      } catch {
        autoClear("Failed to remove keyword", true);
        setRemoving(null);
        return false;
      }
    },
    [token, router, autoClear]
  );

  return { adding, editing, removing, feedback, error, addKeyword, editKeyword, removeKeyword, clearError };
}
