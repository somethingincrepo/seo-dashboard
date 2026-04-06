import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { airtablePatch } from "@/lib/airtable";
import type { KeywordGroup, Subkeyword } from "@/components/portal/KeywordGroups";

// ─── DataForSEO Enrichment ────────────────────────────────────────────────────
async function enrichKeyword(keyword: string): Promise<{
  volume: number;
  difficulty: number;
  intent: string;
  enriched: boolean;
}> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return { volume: 0, difficulty: 0, intent: "", enriched: false };

  try {
    const res = await fetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
        },
        body: JSON.stringify([{ keyword, location_code: 2840, language_code: "en", limit: 1 }]),
      }
    );
    if (!res.ok) return { volume: 0, difficulty: 0, intent: "", enriched: false };

    const data = await res.json();
    // Response path: tasks[0].result[0].items[0].keyword_data
    const kd = data?.tasks?.[0]?.result?.[0]?.items?.[0]?.keyword_data;
    return {
      volume: kd?.keyword_info?.search_volume ?? 0,
      difficulty: Math.max(0, Math.min(100, kd?.keyword_properties?.keyword_difficulty ?? 0)),
      intent: kd?.search_intent_info?.main_intent ?? "",
      enriched: true,
    };
  } catch {
    return { volume: 0, difficulty: 0, intent: "", enriched: false };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const YOUR_KEYWORDS_GROUP = "Your Keywords";

function parseCustomGroups(raw: string | undefined): KeywordGroup[] {
  try {
    return JSON.parse(raw || "[]") as KeywordGroup[];
  } catch {
    return [];
  }
}

function getAllSubkeywords(groups: KeywordGroup[]): Subkeyword[] {
  return groups.flatMap((g) => g.subkeywords);
}

function findKeyword(groups: KeywordGroup[], keyword: string): string | null {
  const lower = keyword.toLowerCase().trim();
  for (const g of groups) {
    for (const kw of g.subkeywords) {
      if (kw.keyword.toLowerCase().trim() === lower) return kw.keyword;
    }
  }
  return null;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, token } = body;

    if (!action || !token) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["add", "edit", "remove"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const client = await getClientByToken(token);
    if (!client) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    // NOTE: read-modify-write is non-atomic. Acceptable since portal tokens are single-user.
    const groups = parseCustomGroups(client.fields.custom_keyword_groups);

    // ── add ──────────────────────────────────────────────────────────────────
    if (action === "add") {
      const keyword = (body.keyword ?? "").trim();
      if (!keyword) return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
      if (keyword.length > 100) return NextResponse.json({ error: "Keyword too long" }, { status: 400 });

      if (findKeyword(groups, keyword)) {
        return NextResponse.json({ error: "Keyword already added" }, { status: 409 });
      }

      if (getAllSubkeywords(groups).length >= 50) {
        return NextResponse.json({ error: "Maximum of 50 custom keywords reached" }, { status: 400 });
      }

      const { volume, difficulty, intent } = await enrichKeyword(keyword);

      const yourGroup = groups.find((g) => g.group === YOUR_KEYWORDS_GROUP);
      if (yourGroup) {
        yourGroup.subkeywords.push({ keyword, volume, difficulty, intent });
      } else {
        groups.push({
          group: YOUR_KEYWORDS_GROUP,
          description: "",
          subkeywords: [{ keyword, volume, difficulty, intent }],
        });
      }

      await airtablePatch("Clients", client.id, {
        custom_keyword_groups: JSON.stringify(groups),
      });

      return NextResponse.json({ ok: true, keyword, volume, difficulty, intent });
    }

    // ── edit ─────────────────────────────────────────────────────────────────
    if (action === "edit") {
      const oldKeyword = (body.oldKeyword ?? "").trim();
      const newKeyword = (body.newKeyword ?? "").trim();
      if (!oldKeyword || !newKeyword) {
        return NextResponse.json({ error: "oldKeyword and newKeyword are required" }, { status: 400 });
      }
      if (newKeyword.length > 100) {
        return NextResponse.json({ error: "Keyword too long" }, { status: 400 });
      }

      // Duplicate check: new keyword must not already exist (unless it's the same as old)
      const existingMatch = findKeyword(groups, newKeyword);
      if (existingMatch && existingMatch.toLowerCase().trim() !== oldKeyword.toLowerCase().trim()) {
        return NextResponse.json({ error: "Keyword already added" }, { status: 409 });
      }

      // Find and replace
      let found = false;
      for (const g of groups) {
        for (let i = 0; i < g.subkeywords.length; i++) {
          if (g.subkeywords[i].keyword.toLowerCase().trim() === oldKeyword.toLowerCase().trim()) {
            const { volume, difficulty, intent } = await enrichKeyword(newKeyword);
            g.subkeywords[i] = { keyword: newKeyword, volume, difficulty, intent };
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
      }

      await airtablePatch("Clients", client.id, {
        custom_keyword_groups: JSON.stringify(groups),
      });

      const saved = getAllSubkeywords(groups).find(
        (kw) => kw.keyword.toLowerCase().trim() === newKeyword.toLowerCase().trim()
      )!;
      return NextResponse.json({ ok: true, ...saved });
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (action === "remove") {
      const keyword = (body.keyword ?? "").trim();
      if (!keyword) return NextResponse.json({ error: "Keyword is required" }, { status: 400 });

      const lower = keyword.toLowerCase().trim();
      for (const g of groups) {
        g.subkeywords = g.subkeywords.filter(
          (kw) => kw.keyword.toLowerCase().trim() !== lower
        );
      }
      // Remove empty groups
      const updated = groups.filter((g) => g.subkeywords.length > 0);

      await airtablePatch("Clients", client.id, {
        custom_keyword_groups: JSON.stringify(updated),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (err) {
    console.error("[/api/portal/keywords]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
