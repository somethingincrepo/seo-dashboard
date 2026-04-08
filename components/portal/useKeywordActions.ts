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
    setTimeout(() => { setError(null); setFeedback(null); }, 2500);
  }, []);

  const post = useCallback(async (body: object) => {
    return fetch("/api/portal/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
  }, [token]);

  const addKeyword = useCallback(
    async (keyword: string, groupName?: string): Promise<boolean> => {
      setAdding(true);
      setError(null);
      try {
        const res = await post({ action: "add", keyword, ...(groupName ? { groupName } : {}) });
        const data = await res.json();
        if (!res.ok) { autoClear(data.error || "Failed to add keyword", true); return false; }
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
    [post, router, autoClear]
  );

  const editKeyword = useCallback(
    async (oldKeyword: string, newKeyword: string): Promise<boolean> => {
      setEditing(oldKeyword);
      setError(null);
      try {
        const res = await post({ action: "edit", oldKeyword, newKeyword });
        const data = await res.json();
        if (!res.ok) { autoClear(data.error || "Failed to update keyword", true); setEditing(null); return false; }
        autoClear("Keyword updated");
        router.refresh();
        setEditing(null);
        return true;
      } catch {
        autoClear("Failed to update keyword", true);
        setEditing(null);
        return false;
      }
    },
    [post, router, autoClear]
  );

  const removeKeyword = useCallback(
    async (keyword: string): Promise<boolean> => {
      setRemoving(keyword);
      setError(null);
      try {
        const res = await post({ action: "remove", keyword });
        const data = await res.json();
        if (!res.ok) { autoClear(data.error || "Failed to remove keyword", true); setRemoving(null); return false; }
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
    [post, router, autoClear]
  );

  const createGroup = useCallback(
    async (groupName: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await post({ action: "createGroup", groupName });
        const data = await res.json();
        if (!res.ok) { autoClear(data.error || "Failed to create group", true); return false; }
        router.refresh();
        return true;
      } catch {
        autoClear("Failed to create group", true);
        return false;
      }
    },
    [post, router, autoClear]
  );

  const deleteGroup = useCallback(
    async (groupName: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await post({ action: "deleteGroup", groupName });
        const data = await res.json();
        if (!res.ok) { autoClear(data.error || "Failed to delete group", true); return false; }
        router.refresh();
        return true;
      } catch {
        autoClear("Failed to delete group", true);
        return false;
      }
    },
    [post, router, autoClear]
  );

  const renameGroup = useCallback(
    async (oldName: string, newName: string): Promise<boolean> => {
      setError(null);
      try {
        const res = await post({ action: "renameGroup", oldName, newName });
        const data = await res.json();
        if (!res.ok) { autoClear(data.error || "Failed to rename group", true); return false; }
        router.refresh();
        return true;
      } catch {
        autoClear("Failed to rename group", true);
        return false;
      }
    },
    [post, router, autoClear]
  );

  return { adding, editing, removing, feedback, error, addKeyword, editKeyword, removeKeyword, createGroup, deleteGroup, renameGroup, clearError };
}
