import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { airtablePatch } from "@/lib/airtable";
import type { KeywordGroup, Subkeyword } from "@/components/portal/KeywordGroups";

const TABLE = "Clients";
const MAX_CUSTOM_KEYWORDS = 50;

// DataForSEO enrichment — uses keywords_data/search_volume endpoint for volume + keywords_data/keyword_info for difficulty
async function enrichKeyword(keyword: string): Promise<Subkeyword & { enriched: boolean }> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return { keyword, volume: 0, difficulty: 0, intent: "", enriched: false };
  }

  try {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");

    // Step 1: Get search volume
    const volRes = await fetch("https://api.dataforseo.com/v3/keywords_data/google/search_volume/live", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { keywords: [keyword], location_code: 2840, language_code: "en" },
      ]),
    });

    if (!volRes.ok) {
      return { keyword, volume: 0, difficulty: 0, intent: "", enriched: false };
    }

    const volData = await volRes.json();
    const volTask = volData.tasks?.[0];
    const volResult = volTask?.result?.[0];

    if (!volResult || typeof volResult.search_volume !== "number") {
      return { keyword, volume: 0, difficulty: 0, intent: "", enriched: false };
    }

    const volume = volResult.search_volume as number;

    // Step 2: Get keyword difficulty (different endpoint)
    const kdRes = await fetch("https://api.dataforseo.com/v3/keywords_data/google/keywords/live", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { keywords: [keyword], location_code: 2840, language_code: "en" },
      ]),
    });

    let difficulty = 0;
    let intent = "";

    if (kdRes.ok) {
      const kdData = await kdRes.json();
      const kdTask = kdData.tasks?.[0];
      const kdItems = kdTask?.result?.[0]?.items;
      if (kdItems && kdItems.length > 0) {
        const item = kdItems[0];
        difficulty = Math.max(0, Math.min(100, (item.keyword_info?.keyword_difficulty as number) ?? 0));
        intent = (item.keyword_info?.search_intent_info?.main_intent as string) ?? "";
      }
    }

    return { keyword, volume, difficulty, intent, enriched: true };
  } catch {
    return { keyword, volume: 0, difficulty: 0, intent: "", enriched: false };
  }
}

function parseCustomGroups(raw: string | undefined | null): KeywordGroup[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function flattenSubkeywords(groups: KeywordGroup[]): Subkeyword[] {
  return groups.flatMap((g) => g.subkeywords);
}

function totalCustomCount(groups: KeywordGroup[]): number {
  return flattenSubkeywords(groups).length;
}

function findOrCreateYourKeywordsGroup(groups: KeywordGroup[]): KeywordGroup {
  const existing = groups.find((g) => g.group === "Your Keywords");
  if (existing) return existing;
  const newGroup: KeywordGroup = { group: "Your Keywords", description: "", subkeywords: [] };
  groups.push(newGroup);
  return newGroup;
}

async function patchCustomGroups(recordId: string, groups: KeywordGroup[]) {
  // Remove empty groups
  const clean = groups.filter((g) => g.subkeywords.length > 0);
  await airtablePatch(TABLE, recordId, { custom_keyword_groups: JSON.stringify(clean) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, token } = body;

    if (!token || !action) {
      return NextResponse.json({ error: "Missing token or action" }, { status: 400 });
    }

    const client = await getClientByToken(token);
    if (!client) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    const groups = parseCustomGroups(client.fields.custom_keyword_groups);

    if (action === "add") {
      const keyword = (body.keyword as string)?.trim();
      if (!keyword || keyword.length > 100) {
        return NextResponse.json({ error: "Keyword must be 1-100 characters" }, { status: 400 });
      }

      const all = flattenSubkeywords(groups);
      if (all.some((kw) => kw.keyword.toLowerCase() === keyword.toLowerCase())) {
        return NextResponse.json({ error: "Keyword already added" }, { status: 409 });
      }

      if (totalCustomCount(groups) >= MAX_CUSTOM_KEYWORDS) {
        return NextResponse.json({ error: `Maximum ${MAX_CUSTOM_KEYWORDS} keywords reached` }, { status: 400 });
      }

      const enriched = await enrichKeyword(keyword);
      const yourGroup = findOrCreateYourKeywordsGroup(groups);
      yourGroup.subkeywords.push(enriched);

      await patchCustomGroups(client.id, groups);

      return NextResponse.json({ ok: true, keyword: enriched.keyword, volume: enriched.volume, difficulty: enriched.difficulty, intent: enriched.intent, enriched: enriched.enriched });
    }

    if (action === "edit") {
      const oldKeyword = (body.oldKeyword as string)?.trim();
      const newKeyword = (body.newKeyword as string)?.trim();

      if (!oldKeyword || !newKeyword || newKeyword.length > 100) {
        return NextResponse.json({ error: "Both keywords required, max 100 chars" }, { status: 400 });
      }

      const all = flattenSubkeywords(groups);
      if (all.some((kw) => kw.keyword.toLowerCase() === newKeyword.toLowerCase() && kw.keyword.toLowerCase() !== oldKeyword.toLowerCase())) {
        return NextResponse.json({ error: "Keyword already exists" }, { status: 409 });
      }

      let found = false;
      for (const group of groups) {
        for (let i = 0; i < group.subkeywords.length; i++) {
          if (group.subkeywords[i].keyword.toLowerCase() === oldKeyword.toLowerCase()) {
            const enriched = await enrichKeyword(newKeyword);
            group.subkeywords[i] = enriched;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
      }

      await patchCustomGroups(client.id, groups);

      return NextResponse.json({ ok: true, keyword: newKeyword, volume: groups.flatMap((g) => g.subkeywords).find((kw) => kw.keyword.toLowerCase() === newKeyword.toLowerCase())?.volume ?? 0, difficulty: groups.flatMap((g) => g.subkeywords).find((kw) => kw.keyword.toLowerCase() === newKeyword.toLowerCase())?.difficulty ?? 0, intent: groups.flatMap((g) => g.subkeywords).find((kw) => kw.keyword.toLowerCase() === newKeyword.toLowerCase())?.intent ?? "" });
    }

    if (action === "remove") {
      const keyword = (body.keyword as string)?.trim();
      if (!keyword) {
        return NextResponse.json({ error: "Keyword required" }, { status: 400 });
      }

      for (const group of groups) {
        group.subkeywords = group.subkeywords.filter(
          (kw) => kw.keyword.toLowerCase() !== keyword.toLowerCase()
        );
      }

      await patchCustomGroups(client.id, groups);

      return NextResponse.json({ ok: true });
    }

    if (action === "priority") {
      const keyword = (body.keyword as string)?.trim();
      const priority = body.priority as number;

      if (!keyword || ![1, 2, 3, 4, 5].includes(priority)) {
        return NextResponse.json({ error: "Keyword and valid priority (1-5) required" }, { status: 400 });
      }

      // Check both custom_keyword_groups and keyword_groups
      let customGroups = parseCustomGroups(client.fields.custom_keyword_groups);
      let customFound = false;

      for (const group of customGroups) {
        for (let i = 0; i < group.subkeywords.length; i++) {
          if (group.subkeywords[i].keyword.toLowerCase() === keyword.toLowerCase()) {
            group.subkeywords[i].priority = priority;
            customFound = true;
            break;
          }
        }
        if (customFound) break;
      }

      if (customFound) {
        await patchCustomGroups(client.id, customGroups);
        return NextResponse.json({ ok: true, source: "custom" });
      }

      // Check keyword_groups (AI-generated)
      let aiGroups = parseCustomGroups(client.fields.keyword_groups);
      let aiFound = false;

      for (const group of aiGroups) {
        for (let i = 0; i < group.subkeywords.length; i++) {
          if (group.subkeywords[i].keyword.toLowerCase() === keyword.toLowerCase()) {
            group.subkeywords[i].priority = priority;
            aiFound = true;
            break;
          }
        }
        if (aiFound) break;
      }

      if (aiFound) {
        await airtablePatch(TABLE, client.id, { keyword_groups: JSON.stringify(aiGroups) });
        return NextResponse.json({ ok: true, source: "ai" });
      }

      return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
