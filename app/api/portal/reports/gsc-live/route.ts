import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { executeGscQuery, executeGscTotals } from "@/lib/tools/gsc";

export const dynamic = "force-dynamic";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// Derive brand terms from company name and site URL for brand/non-brand filtering
function deriveBrandTerms(companyName: string, siteUrl: string): string[] {
  const terms = new Set<string>();

  if (companyName) {
    const name = companyName.trim().toLowerCase();
    terms.add(name); // full name: "tidal treasures"
    // Individual words (skip very short words like "and", "the", "of")
    for (const word of name.split(/[\s\-_]+/)) {
      if (word.length > 2) terms.add(word);
    }
  }

  if (siteUrl) {
    try {
      const host = new URL(siteUrl).hostname.replace(/^www\./, "");
      // Strip TLD: "tidaltreasures.com" → "tidaltreasures"
      const noTld = host.replace(/\.[^.]+$/, "");
      if (noTld) {
        terms.add(noTld.toLowerCase());
        // Handle hyphenated domains: "tidal-treasures" → also add "tidal treasures"
        if (noTld.includes("-")) {
          terms.add(noTld.replace(/-/g, " ").toLowerCase());
          for (const part of noTld.split("-")) {
            if (part.length > 2) terms.add(part.toLowerCase());
          }
        }
      }
    } catch {
      // ignore malformed URL
    }
  }

  return [...terms].filter(Boolean);
}

// Build trend data — aggregates daily GSC rows by range (daily / weekly / monthly)
type TrendRow = { keys: string[]; clicks: number; impressions: number; position: number };

function buildTrend(rows: TrendRow[], rangeDays: number) {
  const sorted = [...rows].sort((a, b) => (a.keys[0] ?? "").localeCompare(b.keys[0] ?? ""));

  if (rangeDays <= 28) {
    return sorted.map((row) => {
      const d = new Date(row.keys[0] ?? "");
      return {
        month_label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        clicks: row.clicks,
        impressions: row.impressions,
        avg_position: row.position,
      };
    });
  }

  if (rangeDays <= 90) {
    const buckets = new Map<number, { clicks: number; impressions: number; impr_pos_sum: number; firstDate: string }>();
    if (sorted.length > 0) {
      const startTs = new Date(sorted[0].keys[0] ?? "").getTime();
      for (const row of sorted) {
        const dayIdx = Math.floor((new Date(row.keys[0] ?? "").getTime() - startTs) / 86400000);
        const bucket = Math.floor(dayIdx / 7);
        const e = buckets.get(bucket) ?? { clicks: 0, impressions: 0, impr_pos_sum: 0, firstDate: row.keys[0] ?? "" };
        e.clicks += row.clicks; e.impressions += row.impressions; e.impr_pos_sum += row.position * row.impressions;
        buckets.set(bucket, e);
      }
    }
    return [...buckets.entries()].sort(([a], [b]) => a - b).map(([, e]) => ({
      month_label: new Date(e.firstDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      clicks: e.clicks, impressions: e.impressions,
      avg_position: e.impressions > 0 ? e.impr_pos_sum / e.impressions : 0,
    }));
  }

  // Monthly buckets (6mo)
  const byMonth = new Map<string, { clicks: number; impressions: number; impr_pos_sum: number }>();
  for (const row of sorted) {
    const monthKey = (row.keys[0] ?? "").slice(0, 7);
    if (!monthKey) continue;
    const e = byMonth.get(monthKey) ?? { clicks: 0, impressions: 0, impr_pos_sum: 0 };
    e.clicks += row.clicks; e.impressions += row.impressions; e.impr_pos_sum += row.position * row.impressions;
    byMonth.set(monthKey, e);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, e]) => ({
    month_label: new Date(key + "-15").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    clicks: e.clicks, impressions: e.impressions,
    avg_position: e.impressions > 0 ? e.impr_pos_sum / e.impressions : 0,
  }));
}

// Build period windows for keyword sparklines based on selected range
function buildPeriodWindows(rangeDays: number): { start: string; end: string; label: string }[] {
  if (rangeDays === 28) {
    // 4 consecutive 28-day windows (original behavior)
    return [
      { start: daysAgo(112), end: daysAgo(85), label: "3mo ago" },
      { start: daysAgo(84),  end: daysAgo(57), label: "2mo ago" },
      { start: daysAgo(56),  end: daysAgo(29), label: "Last mo" },
      { start: daysAgo(28),  end: daysAgo(1),  label: "Now" },
    ];
  }
  // For other ranges: 3 consecutive windows of rangeDays each
  const labels: Record<number, [string, string, string]> = {
    90:  ["-6mo",  "-3mo",  "Now"],
    180: ["-1yr",  "-6mo",  "Now"],
  };
  const [l1, l2, l3] = labels[rangeDays] ?? ["-2x", "-1x", "Now"];
  return [
    { start: daysAgo(rangeDays * 3), end: daysAgo(rangeDays * 2 + 1), label: l1 },
    { start: daysAgo(rangeDays * 2), end: daysAgo(rangeDays + 1),      label: l2 },
    { start: daysAgo(rangeDays),     end: daysAgo(1),                   label: l3 },
  ];
}

// Parse keyword groups from JSON string fields, returning flat keyword list with metadata
type KwGroup = { group?: string; subkeywords?: { keyword: string; volume?: number; difficulty?: number; intent?: string }[] };
function parseKeywordGroups(raw: string | undefined): { keyword: string; group: string; volume: number; difficulty: number; intent: string }[] {
  if (!raw) return [];
  try {
    const groups = JSON.parse(raw) as KwGroup[];
    return groups.flatMap((g) =>
      (g.subkeywords ?? []).map((sk) => ({
        keyword: sk.keyword,
        group: g.group ?? "",
        volume: sk.volume ?? 0,
        difficulty: sk.difficulty ?? 0,
        intent: sk.intent ?? "",
      }))
    );
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const property = client.fields.gsc_property;
  if (!property) return NextResponse.json({ connected: false });

  // Date range: 28 | 90 | 180 days (default 28)
  const rangeParam = request.nextUrl.searchParams.get("range");
  const rangeDays = [90, 180].includes(Number(rangeParam)) ? Number(rangeParam) : 28;

  const thisStart = daysAgo(rangeDays);
  const thisEnd = daysAgo(1);
  const priorStart = daysAgo(rangeDays * 2);
  const priorEnd = daysAgo(rangeDays + 1);

  // Derive brand terms
  const brandTerms = deriveBrandTerms(
    client.fields.company_name ?? "",
    client.fields.site_url ?? ""
  );

  // Flatten keyword groups for cross-reference
  const allKeywords = [
    ...parseKeywordGroups(client.fields.keyword_groups),
    ...parseKeywordGroups(client.fields.custom_keyword_groups),
  ];
  // Deduplicate by lowercase keyword
  const seen = new Set<string>();
  const dedupedKeywords = allKeywords.filter((kw) => {
    const k = kw.keyword.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  try {
    // Run core queries in parallel — including no-dimension totals for accurate metric numbers
    const [thisResult, priorResult, trendResult, thisTotals, priorTotals] = await Promise.all([
      executeGscQuery({ property, start_date: thisStart, end_date: thisEnd, dimensions: ["query"], row_limit: 500 }),
      executeGscQuery({ property, start_date: priorStart, end_date: priorEnd, dimensions: ["query"], row_limit: 500 }),
      // Trend uses same window as the selected range — daily data aggregated by buildTrend
      executeGscQuery({ property, start_date: thisStart, end_date: thisEnd, dimensions: ["date"], row_limit: 500 }),
      executeGscTotals({ property, start_date: thisStart, end_date: thisEnd }),
      executeGscTotals({ property, start_date: priorStart, end_date: priorEnd }),
    ]);

    // Top 10 queries by clicks — annotated with target keyword group if matched
    const targetKeywordMap = new Map(dedupedKeywords.map((kw) => [kw.keyword.toLowerCase(), kw.group]));
    const topQueries = [...thisResult.rows]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)
      .map((r) => {
        const q = r.keys[0] ?? "";
        const group = targetKeywordMap.get(q.toLowerCase());
        return {
          query: q,
          clicks: r.clicks,
          impressions: r.impressions,
          position: r.position,
          is_target: group !== undefined,
          group: group ?? null,
        };
      });

    const trend = buildTrend(trendResult.rows, rangeDays);

    // Extended: scaled keyword position trends + page performance (graceful degradation)
    let keywordTrends: undefined | {
      keyword: string;
      points: { label: string; position: number }[];
      position: number;
      direction: "up" | "down" | "flat";
    }[];
    let pageGaining: undefined | { page: string; clicks_this: number; clicks_prior: number; delta: number }[];
    let pageLosing:  undefined | { page: string; clicks_this: number; clicks_prior: number; delta: number }[];

    try {
      const periodWindows = buildPeriodWindows(rangeDays);
      // Run all period queries + page queries in parallel
      const periodResults = await Promise.all(
        periodWindows.map((w) =>
          executeGscQuery({ property, start_date: w.start, end_date: w.end, dimensions: ["query"], row_limit: 500 })
        )
      );
      const [pageThisResult, pagePriorResult] = await Promise.all([
        executeGscQuery({ property, start_date: thisStart, end_date: thisEnd, dimensions: ["page"], row_limit: 500 }),
        executeGscQuery({ property, start_date: priorStart, end_date: priorEnd, dimensions: ["page"], row_limit: 500 }),
      ]);

      // Build position maps per period
      const periodMaps = periodResults.map((r) => {
        const m = new Map<string, number>();
        for (const row of r.rows) m.set(row.keys[0] ?? "", row.position);
        return m;
      });

      // Top 5 keywords by impressions in the current window
      const top5 = [...thisResult.rows].sort((a, b) => b.impressions - a.impressions).slice(0, 5);

      keywordTrends = top5
        .map((kw) => {
          const keyword = kw.keys[0] ?? "";
          const points = periodMaps
            .map((m, i) => {
              const pos = m.get(keyword);
              return pos != null ? { label: periodWindows[i].label, position: pos } : null;
            })
            .filter((p): p is { label: string; position: number } => p !== null);
          const priorPos = periodMaps[periodMaps.length - 2]?.get(keyword);
          const currPos = kw.position;
          const direction: "up" | "down" | "flat" =
            priorPos == null ? "flat"
            : currPos < priorPos - 0.5 ? "up"
            : currPos > priorPos + 0.5 ? "down"
            : "flat";
          return { keyword, points, position: currPos, direction };
        })
        .filter((kw) => kw.points.length >= 2);

      // Page performance deltas
      const pageThisMap = new Map<string, number>();
      for (const row of pageThisResult.rows) pageThisMap.set(row.keys[0] ?? "", row.clicks);
      const pagePriorMap = new Map<string, number>();
      for (const row of pagePriorResult.rows) pagePriorMap.set(row.keys[0] ?? "", row.clicks);

      const allPages = new Set([...pageThisMap.keys(), ...pagePriorMap.keys()]);
      const deltas: { page: string; clicks_this: number; clicks_prior: number; delta: number }[] = [];
      for (const page of allPages) {
        const ct = pageThisMap.get(page) ?? 0;
        const cp = pagePriorMap.get(page) ?? 0;
        if (ct + cp < 5) continue;
        deltas.push({ page, clicks_this: ct, clicks_prior: cp, delta: ct - cp });
      }

      pageGaining = deltas.filter((p) => p.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
      pageLosing  = deltas.filter((p) => p.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);
    } catch {
      // Extended queries failed — base metrics still render
    }

    // Keyword rankings: cross-reference target keywords with current GSC positions
    const gscQueryMap = new Map<string, { position: number; clicks: number; impressions: number }>();
    for (const row of thisResult.rows) {
      gscQueryMap.set((row.keys[0] ?? "").toLowerCase(), {
        position: row.position,
        clicks: row.clicks,
        impressions: row.impressions,
      });
    }
    const keywordRankings = dedupedKeywords.length > 0
      ? dedupedKeywords
          .map((kw) => {
            const d = gscQueryMap.get(kw.keyword.toLowerCase());
            return { ...kw, position: d?.position ?? null, clicks: d?.clicks ?? 0, impressions: d?.impressions ?? 0 };
          })
          .sort((a, b) => a.position === null ? 1 : b.position === null ? -1 : a.position - b.position)
      : undefined;

    return NextResponse.json({
      connected: true,
      range_days: rangeDays,
      this: thisTotals,
      prior: priorTotals,
      trend,
      top_queries: topQueries,
      keyword_trends: keywordTrends,
      page_gaining: pageGaining,
      page_losing: pageLosing,
      keyword_rankings: keywordRankings,
      brand_terms: brandTerms,
    });
  } catch (err) {
    console.error("[gsc-live]", err);
    return NextResponse.json({ connected: false, error: String(err) });
  }
}
