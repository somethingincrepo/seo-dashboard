import type Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../supabase";

/**
 * supabase_fetch — read rows from a whitelisted Supabase table.
 *
 * Restricted to a small allowlist so a prompt-injection attack via a tool
 * input field can't pivot to arbitrary table reads (e.g. admin_users,
 * invite_tokens). The audit fix-generation flow only needs read access to
 * issues + pages + audit_runs + the Clients-derived data we already pass
 * via Airtable.
 */

const READ_ALLOWLIST = new Set([
  "issues",
  "pages",
  "audit_runs",
]);

export type FilterOp = "eq" | "in" | "gt" | "gte" | "lt" | "lte" | "neq";

interface FetchInput {
  table: string;
  /** Field-level filters. Supports basic ops; combine multiple with implicit AND. */
  filters?: Array<{ field: string; op: FilterOp; value: string | number | boolean | string[] }>;
  /** Whitelist of fields to return. Omit to return all columns. */
  fields?: string[];
  /** Max rows. Default 100, hard cap 1000. */
  limit?: number;
  /** Optional ORDER BY. */
  order_by?: { field: string; ascending?: boolean };
}

export const supabaseFetchDefinition: Anthropic.Messages.Tool = {
  name: "supabase_fetch",
  description:
    "Read rows from a whitelisted Supabase table (issues, pages, audit_runs). Used by fix-generation SOPs to load issue context. Supports basic eq/in/gt/lt filters; combine multiple filters with implicit AND.",
  input_schema: {
    type: "object" as const,
    properties: {
      table: {
        type: "string",
        enum: [...READ_ALLOWLIST],
        description: "Target table. Only issues/pages/audit_runs are accessible.",
      },
      filters: {
        type: "array",
        description: "List of {field, op, value} filters. ANDed together.",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            op: { type: "string", enum: ["eq", "in", "gt", "gte", "lt", "lte", "neq"] },
            value: {},
          },
          required: ["field", "op", "value"],
        },
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Whitelist of columns to return. Omit to select *.",
      },
      limit: { type: "number", description: "Max rows. Default 100, max 1000." },
      order_by: {
        type: "object",
        properties: {
          field: { type: "string" },
          ascending: { type: "boolean" },
        },
        required: ["field"],
      },
    },
    required: ["table"],
  },
};

export async function executeSupabaseFetch(input: FetchInput): Promise<unknown> {
  if (!READ_ALLOWLIST.has(input.table)) {
    return { error: `Table not in read allowlist: ${input.table}` };
  }
  const limit = Math.min(Math.max(1, input.limit ?? 100), 1000);
  const select = input.fields && input.fields.length > 0 ? input.fields.join(",") : "*";

  let query = getSupabase().from(input.table).select(select);

  for (const f of input.filters ?? []) {
    switch (f.op) {
      case "eq": query = query.eq(f.field, f.value as string | number | boolean); break;
      case "in": query = query.in(f.field, f.value as (string | number)[]); break;
      case "gt": query = query.gt(f.field, f.value as string | number); break;
      case "gte": query = query.gte(f.field, f.value as string | number); break;
      case "lt": query = query.lt(f.field, f.value as string | number); break;
      case "lte": query = query.lte(f.field, f.value as string | number); break;
      case "neq": query = query.neq(f.field, f.value as string | number | boolean); break;
    }
  }
  if (input.order_by) {
    query = query.order(input.order_by.field, { ascending: input.order_by.ascending ?? true });
  }
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { rows: data ?? [], count: (data ?? []).length };
}
