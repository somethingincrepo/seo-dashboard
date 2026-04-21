import type Anthropic from "@anthropic-ai/sdk";
import { getGoogleAccessToken } from "./google-auth";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

// ---------------------------------------------------------------------------
// gsc_query — fetch clicks/impressions/position for a GSC property
// ---------------------------------------------------------------------------

export const gscQueryDefinition: Anthropic.Messages.Tool = {
  name: "gsc_query",
  description:
    "Query Google Search Console for clicks, impressions, CTR, and average position. " +
    "Use for report data (monthly comparisons) and ranking opportunity identification. " +
    "The property must be verified and accessible by the service account.",
  input_schema: {
    type: "object" as const,
    properties: {
      property: {
        type: "string",
        description:
          "GSC property URL exactly as it appears in Search Console, e.g. 'https://example.com/' or 'sc-domain:example.com'",
      },
      start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
      end_date: { type: "string", description: "End date in YYYY-MM-DD format" },
      dimensions: {
        type: "array",
        items: { type: "string", enum: ["query", "page", "country", "device", "date"] },
        description: "Dimensions to group by (default: ['query'])",
      },
      row_limit: { type: "number", description: "Max rows to return (default: 100, max: 25000)" },
      dimension_filter: {
        type: "object",
        description: "Optional filter object: { dimension: 'query', operator: 'contains', expression: 'brand' }",
        additionalProperties: true,
      },
    },
    required: ["property", "start_date", "end_date"],
  },
};

type GscQueryInput = {
  property: string;
  start_date: string;
  end_date: string;
  dimensions?: string[];
  row_limit?: number;
  dimension_filter?: Record<string, unknown>;
  _fallback?: boolean; // internal: prevents infinite retry loop
};

type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type GscQueryResult = {
  rows: GscRow[];
  total_clicks: number;
  total_impressions: number;
  avg_position: number;
};

// ---------------------------------------------------------------------------
// Property resolution — finds the best accessible alternative when 403
// ---------------------------------------------------------------------------

// Extract the bare domain from either property format:
//   sc-domain:example.com  →  "example.com"
//   https://example.com/   →  "example.com"
function propertyDomain(property: string): string {
  if (property.startsWith("sc-domain:")) {
    return property.replace("sc-domain:", "").replace(/\/$/, "");
  }
  try {
    return new URL(property).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Check the sites list and return the best accessible property for the same domain.
// Returns null if nothing better is found.
async function findAccessibleAlternative(property: string, token: string): Promise<string | null> {
  try {
    const res = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const sites: { siteUrl: string; permissionLevel: string }[] = data.siteEntry ?? [];

    // Prefer higher-permission properties (owner > fullUser > restrictedUser)
    const permissionRank: Record<string, number> = {
      siteOwner: 4, siteFullUser: 3, siteRestrictedUser: 2, siteUnverifiedUser: 0,
    };

    const targetDomain = propertyDomain(property);
    if (!targetDomain) return null;

    const candidates = sites
      .filter((s) => {
        const d = propertyDomain(s.siteUrl);
        return (d === targetDomain || d === `www.${targetDomain}` || `www.${d}` === targetDomain)
          && permissionRank[s.permissionLevel] > 0; // exclude unverified
      })
      .sort((a, b) => (permissionRank[b.permissionLevel] ?? 0) - (permissionRank[a.permissionLevel] ?? 0));

    // Don't return the same property we already tried
    const best = candidates.find((s) => s.siteUrl !== property);
    return best ? best.siteUrl : null;
  } catch {
    return null;
  }
}

// Public helper: resolves the best accessible property for a given stored value.
// Use this at save time (integration endpoints) to auto-correct before writing to Airtable.
export async function resolveGscProperty(
  property: string
): Promise<{ property: string; changed: boolean }> {
  const token = await getGoogleAccessToken(GSC_SCOPE);
  const alt = await findAccessibleAlternative(property, token);
  if (alt && alt !== property) {
    return { property: alt, changed: true };
  }
  return { property, changed: false };
}

// ---------------------------------------------------------------------------
// executeGscTotals — no-dimension query for accurate aggregate counts
// ---------------------------------------------------------------------------

export async function executeGscTotals(
  input: Pick<GscQueryInput, "property" | "start_date" | "end_date">
): Promise<{ clicks: number; impressions: number; avg_position: number; ctr: number }> {
  const result = await executeGscQuery({ ...input, dimensions: [], row_limit: 1 });
  const { total_clicks: clicks, total_impressions: impressions, avg_position } = result;
  return { clicks, impressions, avg_position, ctr: impressions > 0 ? clicks / impressions : 0 };
}

// ---------------------------------------------------------------------------
// executeGscQuery — main query function with auto-resolve on 403
// ---------------------------------------------------------------------------

export async function executeGscQuery(input: GscQueryInput): Promise<GscQueryResult> {
  const { property, start_date, end_date, dimensions = ["query"], row_limit = 100 } = input;

  const token = await getGoogleAccessToken(GSC_SCOPE);

  const body: Record<string, unknown> = {
    startDate: start_date,
    endDate: end_date,
    rowLimit: Math.min(row_limit, 25000),
    dataState: "all",
  };
  // Omit dimensions for no-dimension aggregate queries (exact totals)
  if (dimensions.length > 0) body.dimensions = dimensions;
  if (input.dimension_filter) {
    body.dimensionFilterGroups = [{ filters: [input.dimension_filter] }];
  }

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    // On 403, try to find an accessible alternative property for the same domain.
    // This handles the common case where sc-domain: is stored but only the URL-prefix
    // property (or vice versa) is actually accessible by the Google account.
    if (res.status === 403 && !input._fallback) {
      const alt = await findAccessibleAlternative(property, token);
      if (alt) {
        console.log(`[gsc] Auto-resolving property: ${property} → ${alt}`);
        return executeGscQuery({ ...input, property: alt, _fallback: true });
      }
    }
    throw new Error(`GSC query error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const rows: GscRow[] = (data.rows ?? []).map((r: Record<string, unknown>) => ({
    keys: (r.keys as string[]) ?? [],
    clicks: (r.clicks as number) ?? 0,
    impressions: (r.impressions as number) ?? 0,
    ctr: (r.ctr as number) ?? 0,
    position: (r.position as number) ?? 0,
  }));

  const total_clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const total_impressions = rows.reduce((s, r) => s + r.impressions, 0);
  // GSC uses impressions-weighted average position (not a simple mean)
  const avg_position =
    total_impressions > 0
      ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / total_impressions
      : 0;

  return { rows, total_clicks, total_impressions, avg_position };
}
