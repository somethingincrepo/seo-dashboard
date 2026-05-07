// Tokenizes both strings on whitespace (preserving the whitespace tokens),
// strips a common prefix and a common suffix, and marks the middle as
// changed. Not a full LCS — for the kinds of edits we render (paragraph
// rewrites, sentence inserts, single-word swaps in a meta title) the
// prefix/suffix heuristic produces the same visual result and is much
// simpler. Renderers wrap consecutive `changed: true` tokens however they
// like (bold-italic for the proposed panel; could be a `del` for a
// removed-side renderer).

export function wordDiff(
  oldText: string,
  newText: string,
): Array<{ text: string; changed: boolean }> {
  if (!oldText || !newText) {
    return [{ text: newText, changed: !!newText && !oldText }];
  }
  const oldT = oldText.split(/(\s+)/);
  const newT = newText.split(/(\s+)/);
  let p = 0;
  while (p < oldT.length && p < newT.length && oldT[p] === newT[p]) p++;
  let s = 0;
  while (
    s < oldT.length - p &&
    s < newT.length - p &&
    oldT[oldT.length - 1 - s] === newT[newT.length - 1 - s]
  ) {
    s++;
  }
  const out: Array<{ text: string; changed: boolean }> = [];
  for (let i = 0; i < p; i++) out.push({ text: newT[i], changed: false });
  const middle = newT.slice(p, newT.length - s);
  if (middle.length > 0) {
    out.push({ text: middle.join(""), changed: true });
  }
  for (let i = newT.length - s; i < newT.length; i++) {
    out.push({ text: newT[i], changed: false });
  }
  return out;
}
