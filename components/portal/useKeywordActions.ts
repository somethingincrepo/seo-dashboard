"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface UseKeywordActionsOptions {
  token: string;
}

export function useKeywordActions({ token }: UseKeywordActionsOptions) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // keyword currently saving in edit mode
  const [removing, setRemoving] = useState<string | null>(null); // keyword currently being removed
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  }, []);

  const addKeyword = useCallback(
    async (keyword: string) => {
      setAdding(true);
      setError(null);
      try {
        const res = await fetch("/api/portal/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", token, keyword }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || `Failed to add keyword (${res.status})`);
          return false;
        }
        showFeedback(`Added — "${keyword}" is now in your keywords`);
        router.refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        return false;
      } finally {
        setAdding(false);
      }
    },
    [token, router, showFeedback]
  );

  const editKeyword = useCallback(
    async (oldKeyword: string, newKeyword: string) => {
      setEditing(oldKeyword);
      setError(null);
      try {
        const res = await fetch("/api/portal/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "edit", token, oldKeyword, newKeyword }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || `Failed to update keyword (${res.status})`);
          return false;
        }
        showFeedback("Keyword updated");
        router.refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        return false;
      } finally {
        setEditing(null);
      }
    },
    [token, router, showFeedback]
  );

  const removeKeyword = useCallback(
    async (keyword: string) => {
      setRemoving(keyword);
      setError(null);
      try {
        const res = await fetch("/api/portal/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "remove", token, keyword }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || `Failed to remove keyword (${res.status})`);
          return false;
        }
        router.refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        return false;
      } finally {
        setRemoving(null);
      }
    },
    [token, router]
  );

  return {
    adding,
    editing,
    removing,
    feedback,
    error,
    addKeyword,
    editKeyword,
    removeKeyword,
    clearError,
  };
}
