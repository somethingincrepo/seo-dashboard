"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface UseArticleActionsOptions {
  token: string;
  onDecisionApplied?: (resultId: string, decision: "approved") => void;
}

export function useArticleActions({ token, onDecisionApplied }: UseArticleActionsOptions) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
    setError(null);
  }, []);

  const applyDecision = useCallback(
    async (resultId: string, decision: "approved", blogTitle: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/content-approval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultId, decision, token, blogTitle }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Server error ${res.status}`);
        }

        setFeedback("Approved — we'll publish this article as a draft shortly.");
        onDecisionApplied?.(resultId, decision);
        router.refresh();
        setTimeout(() => setFeedback(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [token, router, onDecisionApplied]
  );

  return { submitting, feedback, error, clearFeedback, applyDecision };
}
