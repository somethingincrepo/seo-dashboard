"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type Decision = "approved" | "skipped" | "question";

interface UseApprovalActionsOptions {
  token: string;
  onDecisionApplied?: (changeId: string, decision: Decision) => void;
  onUndoApplied?: (changeId: string) => void;
}

export function useApprovalActions({
  token,
  onDecisionApplied,
  onUndoApplied,
}: UseApprovalActionsOptions) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [undoTarget, setUndoTarget] = useState<{
    changeId: string;
    remaining: number;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (undoTarget && undoTarget.remaining > 0) {
      undoTimerRef.current = setInterval(() => {
        setUndoTarget((prev) => {
          if (!prev || prev.remaining <= 1) {
            if (undoTimerRef.current) clearInterval(undoTimerRef.current);
            return null;
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
    }
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
  }, [undoTarget]);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
    setError(null);
  }, []);

  const handleUndo = useCallback(
    async (changeId: string) => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      setUndoTarget(null);
      setSubmitting(true);
      try {
        const res = await fetch("/api/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordId: changeId, decision: "undo", token }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          setError(errBody.error || `Undo failed (${res.status})`);
          return;
        }
        setFeedback("Approval undone — change is back in your queue.");
        onUndoApplied?.(changeId);
        router.refresh();
        setTimeout(() => setFeedback(null), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Undo failed");
      } finally {
        setSubmitting(false);
      }
    },
    [token, router, onUndoApplied]
  );

  const applyDecision = useCallback(
    async (
      changeId: string,
      decision: Decision,
      notes?: string,
      contactEmail?: string
    ) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordId: changeId,
            decision,
            notes,
            token,
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Server error ${res.status}`);
        }

        if (decision === "approved") {
          setFeedback("Approved — we'll implement this within 24 hours.");
          setConfirmApprove(false);
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
          setUndoTarget({ changeId, remaining: 30 });
          router.refresh();
        } else if (decision === "skipped") {
          setFeedback("No problem. You can always revisit this later.");
        } else {
          const email = contactEmail || "your account manager";
          setFeedback(
            `Question submitted. We\u2019ll respond within 1 business day at ${email}.`
          );
        }

        onDecisionApplied?.(changeId, decision);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [token, router, onDecisionApplied]
  );

  return {
    submitting,
    feedback,
    error,
    confirmApprove,
    setConfirmApprove,
    undoTarget,
    handleUndo,
    applyDecision,
    clearFeedback,
  };
}
