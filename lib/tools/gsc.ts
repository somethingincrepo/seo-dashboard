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
      start_date: {
        type: "string",
        description: "Start date in YYYY-MM-DD format",
      },
      end_date: {
        type: "string",
        description: "End date in YYYY-MM-DD format",
      },
      dimensions: {
        type: "array",
        items: { type: "string", enum: ["query", "page", "country", "device", "date"] },
        description: "Dimensions to group by (default: ['query'])",
      },
      row_limit: {
        type: "number",
        description: "Max rows to return (default: 100, max: 25000)",
      },
      dimension_filter: {
        type: "object",
        description:
          "Optional filter object: { dimension: 'query', operator: 'contains', expression: 'brand' }",
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

// executeGscTotals — no-dimension query to get exact aggregate totals from GSC.
// GSC truncates dimensioned queries at row_limit, so summing rows understates the real total.
// A no-dimension query returns a single row with the true site-wide aggregates.
export async function executeGscTotals(input: Pick<GscQueryInput, "property" | "start_date" | "end_date">): Promise<{ clicks: number; impressions: number; avg_position: number; ctr: number }> {
  const result = await executeGscQuery({ ...input, dimensions: [], row_limit: 1 });
  const clicks = result.total_clicks;
  const impressions = result.total_impressions;
  return {
    clicks,
    impressions,
    avg_position: result.avg_position,
    ctr: impressions > 0 ? clicks / impressions : 0,
  };
}

export async function executeGscQuery(input: GscQueryInput): Promise<GscQueryResult> {
  const { property, start_date, end_date, dimensions = ["query"], row_limit = 100 } = input;

  const token = await getGoogleAccessToken(GSC_SCOPE);
  const encodedProperty = encodeURIComponent(property);

  const body: Record<string, unknown> = {
    startDate: start_date,
    endDate: end_date,
    rowLimit: Math.min(row_limit, 25000),
    dataState: "all",
  };
  // Omit dimensions entirely for aggregate (no-dimension) queries — GSC returns exact totals
  if (dimensions.length > 0) body.dimensions = dimensions;

  if (input.dimension_filter) {
    body.dimensionFilterGroups = [
      { filters: [input.dimension_filter] },
    ];
  }

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedProperty}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
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
