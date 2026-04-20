import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { executeGscQuery } from "@/lib/tools/gsc";

export const dynamic = "force-dynamic";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const property = client.fields.gsc_property;
  if (!property) return NextResponse.json({ connected: false });

  try {
    const thisStart = daysAgo(28);
    const thisEnd = daysAgo(1);
    const priorStart = daysAgo(56);
    const priorEnd = daysAgo(29);
    const trendStart = daysAgo(395); // ~13 months

    // Run all three core queries in parallel
    const [thisResult, priorResult, trendResult] = await Promise.all([
      // This period: query dimension for top queries + aggregate
      executeGscQuery({
        property,
        start_date: thisStart,
        end_date: thisEnd,
        dimensions: ["query"],
        row_limit: 500,
      }),
      // Prior period: aggregate only
      executeGscQuery({
        property,
        start_date: priorStart,
        end_date: priorEnd,
        dimensions: ["query"],
        row_limit: 500,
      }),
      // Monthly trend: date dimension
      executeGscQuery({
        property,
        start_date: trendStart,
        end_date: thisEnd,
        dimensions: ["date"],
        row_limit: 500,
      }),
    ]);

    // Aggregate this / prior
    const thisPeriod = {
      clicks: thisResult.total_clicks,
      impressions: thisResult.total_impressions,
      avg_position: thisResult.avg_position,
      ctr: thisResult.total_impressions > 0
        ? thisResult.total_clicks / thisResult.total_impressions
        : 0,
    };
    const priorPeriod = {
      clicks: priorResult.total_clicks,
      impressions: priorResult.total_impressions,
      avg_position: priorResult.avg_position,
      ctr: priorResult.total_impressions > 0
        ? priorResult.total_clicks / priorResult.total_impressions
        : 0,
    };

    // Top 10 queries by clicks
    const topQueries = [...thisResult.rows]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)
      .map((r) => ({
        query: r.keys[0] ?? "",
        clicks: r.clicks,
        impressions: r.impressions,
        position: r.position,
      }));

    // Collapse date rows → monthly buckets
    const byMonth = new Map<string, { clicks: number; impressions: number; pos_sum: number; count: number }>();
    for (const row of trendResult.rows) {
      const dateStr = row.keys[0] ?? "";
      if (!dateStr) continue;
      const monthKey = dateStr.slice(0, 7); // "YYYY-MM"
      const entry = byMonth.get(monthKey) ?? { clicks: 0, impressions: 0, pos_sum: 0, count: 0 };
      entry.clicks += row.clicks;
      entry.impressions += row.impressions;
      entry.pos_sum += row.position;
      entry.count++;
      byMonth.set(monthKey, entry);
    }

    const trend = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, e]) => ({
        month_label: new Date(key + "-15").toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        clicks: e.clicks,
        impressions: e.impressions,
        avg_position: e.count > 0 ? e.pos_sum / e.count : 0,
      }));

    // Extended: keyword position trends + page performance (graceful degradation)
    let keywordTrends: undefined | {
      keyword: string;
      points: { label: string; position: number }[];
      position: number;
      direction: "up" | "down" | "flat";
    }[];
    let pageGaining: undefined | { page: string; clicks_this: number; clicks_prior: number; delta: number }[];
    let pageLosing: undefined | { page: string; clicks_this: number; clicks_prior: number; delta: number }[];

    try {
      const [period2Result, period3Result, pageThisResult, pagePriorResult] = await Promise.all([
        executeGscQuery({ property, start_date: daysAgo(84), end_date: daysAgo(57), dimensions: ["query"], row_limit: 500 }),
        executeGscQuery({ property, start_date: daysAgo(112), end_date: daysAgo(85), dimensions: ["query"], row_limit: 500 }),
        executeGscQuery({ property, start_date: thisStart, end_date: thisEnd, dimensions: ["page"], row_limit: 500 }),
        executeGscQuery({ property, start_date: priorStart, end_date: priorEnd, dimensions: ["page"], row_limit: 500 }),
      ]);

      // Keyword position trends: top 5 by impressions across 4 × 28d windows
      const periodMaps = [period3Result, period2Result, priorResult, thisResult].map((r) => {
        const m = new Map<string, number>();
        for (const row of r.rows) m.set(row.keys[0] ?? "", row.position);
        return m;
      });
      const periodLabels = ["3mo ago", "2mo ago", "Last mo", "Now"];
      const top5 = [...thisResult.rows].sort((a, b) => b.impressions - a.impressions).slice(0, 5);

      keywordTrends = top5
        .map((kw) => {
          const keyword = kw.keys[0] ?? "";
          const points = periodMaps
            .map((m, i) => {
              const pos = m.get(keyword);
              return pos != null ? { label: periodLabels[i], position: pos } : null;
            })
            .filter((p): p is { label: string; position: number } => p !== null);
          const priorPos = periodMaps[2].get(keyword);
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
      pageLosing = deltas.filter((p) => p.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);
    } catch {
      // Extended queries failed — base metrics still render
    }

    return NextResponse.json({
      connected: true,
      this: thisPeriod,
      prior: priorPeriod,
      trend,
      top_queries: topQueries,
      keyword_trends: keywordTrends,
      page_gaining: pageGaining,
      page_losing: pageLosing,
    });
  } catch (err) {
    console.error("[gsc-live]", err);
    return NextResponse.json({ connected: false, error: String(err) });
  }
}
