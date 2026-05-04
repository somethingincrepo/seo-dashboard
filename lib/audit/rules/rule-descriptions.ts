import { ALL_RULES } from "./index";

/**
 * Map of rule_id → the rule's description text (its "what this means / why
 * it matters" copy). Built once from the rule registry. Used by the diagnose
 * route to bake the explanation into each issue's evidence so the client
 * doesn't have to import the entire rule registry.
 */
const _RULE_DESCRIPTIONS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const r of ALL_RULES) out[r.id] = r.description;
  return out;
})();

export function getRuleDescription(rule_id: string): string {
  return _RULE_DESCRIPTIONS[rule_id] ?? "";
}
