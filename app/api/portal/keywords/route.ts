import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { airtablePatch } from "@/lib/airtable";
import type { KeywordGroup, Subkeyword } from "@/components/portal/KeywordGroups";

const TABLE = "Clients";
const MAX_CUSTOM_KEYWORDS = 50;

// DataForSEO enrichment — uses dataforseo_labs/related_keywords endpoint (same as SOP 14)
async function enrichKeyword(keyword: string): Promise<Subkeyword & { enriched: boolean }> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return { keyword, volume: 0, difficulty: 0, intent: "", enriched: false };
  }

  try {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { keyword, location_code: 2840, language_code: "en", limit: 1 },
      ]),
    });

    if (!res.ok) {
      return { keyword, volume: 0, difficulty: 0, intent: "", enriched: false };
    }

    const data = await res.json();
    const task = data.tasks?.[0];
    const items = task?.result?.[0]?.items;

    if (!items || items.length === 0) {
      return { keyword, volume: 0, difficulty: 0, intent: "", enriched: false };
    }

    const keywordData = items[0].keyword_data as Record<string, unknown> | undefined;

    if (!keywordData) {
      return { keyword, volume: 0, difficulty: 0, intent: "", enriched: false };
    }

    const info = keywordData.keyword_info as Record<string, unknown> | undefined;
    const props = keywordData.keyword_properties as Record<string, unknown> | undefined;
    const intentInfo = keywordData.search_intent_info as Record<string, unknown> | undefined;

    const volume = (info?.search_volume as number) ?? 0;
    const rawDiff = (props?.keyword_difficulty as number) ?? 0;
    const difficulty = Math.max(0, Math.min(100, rawDiff));
    const intent = (intentInfo?.main_intent as string) ?? "";

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

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
