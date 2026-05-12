// LCS-based word diff.
//
// Splits both strings into alternating word / whitespace tokens (preserving
// whitespace so joined output reconstructs the exact new string). Runs LCS
// on the WORD tokens only, then emits all new tokens marked changed or not:
//   - Word token: changed = not in LCS (i.e. truly new / replaced)
//   - Whitespace token: always unchanged (spaces are structural, not content)
//
// This correctly handles in-paragraph single-word edits. The old prefix/suffix
// heuristic would mark everything between the first and last differing word as
// changed, producing huge highlighted blocks for minor edits like
// "plastic-free" → "plastic free".

export function wordDiff(
  oldText: string,
  newText: string,
): Array<{ text: string; changed: boolean }> {
  if (!oldText && !newText) return [];
  if (!oldText) return [{ text: newText, changed: true }];
  if (!newText) return [];

  // Split into alternating [word, space, word, space, ...] tokens.
  // The capturing group keeps the whitespace in the array.
  const newTokens = newText.split(/(\s+)/);  // includes "" entries at start/end
  const oldTokens = oldText.split(/(\s+)/);

  // Extract just the word tokens (non-whitespace, non-empty) for LCS.
  const oldWords = oldTokens.filter((t) => t && !/^\s+$/.test(t));
  const newWords = newTokens.filter((t) => t && !/^\s+$/.test(t));

  // LCS on word tokens. Cap at 400 words each side to bound O(m*n).
  const keptInNew = new Set<number>(); // indices into newWords[]

  if (oldWords.length <= 400 && newWords.length <= 400) {
    const m = oldWords.length;
    const n = newWords.length;
    const dp: Uint16Array[] = Array.from(
      { length: m + 1 },
      () => new Uint16Array(n + 1),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          oldWords[i - 1] === newWords[j - 1]
            ? dp[i - 1][j - 1] + 1
            : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        keptInNew.add(j - 1);
        i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
  } else {
    // Fallback for very long texts: any word in new that appears in old → unchanged.
    const oldSet = new Set(oldWords);
    newWords.forEach((w, idx) => { if (oldSet.has(w)) keptInNew.add(idx); });
  }

  // Walk newTokens and emit, tagging word tokens by whether they're in the LCS.
  let wordIdx = 0;
  return newTokens
    .filter((t) => t !== "") // remove empty strings from split boundaries
    .map((token) => {
      if (/^\s+$/.test(token)) {
        // Whitespace: always pass through unchanged
        return { text: token, changed: false };
      }
      const isKept = keptInNew.has(wordIdx);
      wordIdx++;
      return { text: token, changed: !isKept };
    });
}
