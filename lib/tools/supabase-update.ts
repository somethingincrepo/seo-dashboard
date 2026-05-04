import type Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../supabase";

/**
 * supabase_update — update rows on a whitelisted Supabase table.
 *
 * Strictly scoped to fields the fix-generation SOPs need to write:
 * issues.proposed_value, issues.fix_status, issues.fix_generated_at,
 * issues.fix_attempts, issues.fix_error. Anything else is rejected.
 *
 * The where clause requires at least one `id` filter to prevent a runaway
 * update wiping the whole table. No JSON-path writes — only top-level
 * column writes.
 */

const TABLE_ALLOWLIST = new Set(["issues"]);
const WRITABLE_COLUMNS: Record<string, Set<string>> = {
  issues: new Set([
    "proposed_value",
    "fix_status",
    "fix_generated_at",
    "fix_attempts",
    "fix_error",
  ]),
};

interface UpdateInput {
  table: string;
  /** Mandatory: filter by row id. Single id or array of ids. */
  id: string | string[];
  /** Top-level column writes only. */
  set: Record<string, unknown>;
}

export const supabaseUpdateDefinition: Anthropic.Messages.Tool = {
  name: "supabase_update",
  description:
    "Update issue rows in Supabase. Used by fix-generation SOPs to write proposed_value + fix_status + fix_generated_at. Restricted to the issues table and a whitelist of writable columns. Requires an id (or array of ids) — bulk-replace by primary key only, no broader where clauses.",
  input_schema: {
    type: "object" as const,
    properties: {
      table: {
        type: "string",
        enum: [...TABLE_ALLOWLIST],
        description: "Target table. Only 'issues' is writable.",
      },
      id: {
        oneOf: [
          { type: "string", description: "Single issue id (UUID)." },
          { type: "array", items: { type: "string" }, description: "Multiple issue ids." },
        ],
      },
      set: {
        type: "object",
        description:
          "Columns to update. Allowed: proposed_value, fix_status, fix_generated_at, fix_attempts, fix_error.",
      },
    },
    required: ["table", "id", "set"],
  },
};

export async function executeSupabaseUpdate(input: UpdateInput): Promise<unknown> {
  if (!TABLE_ALLOWLIST.has(input.table)) {
    return { error: `Table not in update allowlist: ${input.table}` };
  }
  const writable = WRITABLE_COLUMNS[input.table];
  for (const col of Object.keys(input.set)) {
    if (!writable.has(col)) return { error: `Column not writable on ${input.table}: ${col}` };
  }
  const ids = Array.isArray(input.id) ? input.id : [input.id];
  if (ids.length === 0) return { error: "id is required" };
  if (ids.length > 100) return { error: "Too many ids in one update (cap 100)" };

  let query = getSupabase().from(input.table).update(input.set, { count: "exact" });
  if (ids.length === 1) query = query.eq("id", ids[0]);
  else query = query.in("id", ids);

  const { error, count } = await query;
  if (error) return { error: error.message };
  return { ok: true, updated: count ?? ids.length };
}
