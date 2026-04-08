import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import { airtablePatch } from "@/lib/airtable";
import type { KeywordGroup, Subkeyword } from "@/components/portal/KeywordGroups";

const TABLE = "Clients";
const MAX_CUSTOM_KEYWORDS = 50;

// Infer intent from keyword text — same classification logic as audit_keywords SOP
function inferIntent(keyword: string): string {
  const kw = keyword.toLowerCase();
  if (/pricing|price|\bcost\b|\bbuy\b|near me|\bdemo\b|\bquote\b|\bhire\b|\bbook\b/.test(kw)) return "transactional";
  if (/\bvs\b|versus|alternative|compare|difference/.test(kw)) return "commercial";
  if (/^how |^why |^what |^when |^where |\bbest |\btop |\breview/.test(kw)) return "informational";
  return "informational";
}

async function enrichKeyword(keyword: string): Promise<Subkeyword & { enriched: boolean }> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  // Always infer intent from keyword text — reliable regardless of API
  const intent = inferIntent(keyword);

  if (!login || !password) {
    return { keyword, volume: 0, difficulty: 0, intent, enriched: false };
  }

  try {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");

    const volRes = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keywords: [keyword], location_code: 2840, language_code: "en" }]),
    });

    if (!volRes.ok) {
      return { keyword, volume: 0, difficulty: 0, intent, enriched: false };
    }

    const volData = await volRes.json();
    const volResult = volData.tasks?.[0]?.result?.[0];
    if (!volResult || typeof volResult.search_volume !== "number") {
      return { keyword, volume: 0, difficulty: 0, intent, enriched: false };
    }

    const volume = volResult.search_volume as number;

    // Keyword difficulty via keywords_for_keywords endpoint
    const kdRes = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keywords: [keyword], location_code: 2840, language_code: "en" }]),
    });

    let difficulty = 0;

    if (kdRes.ok) {
      const kdData = await kdRes.json();
      const items = kdData.tasks?.[0]?.result?.[0]?.items;
      if (items && items.length > 0) {
        const match = items.find((i: { keyword: string }) => i.keyword?.toLowerCase() === keyword.toLowerCase()) ?? items[0];
        difficulty = Math.max(0, Math.min(100, (match?.keyword_info?.competition_level === "HIGH" ? 70 : match?.keyword_info?.competition_level === "MEDIUM" ? 40 : 20)));
      }
    }

    return { keyword, volume, difficulty, intent, enriched: true };
  } catch {
    return { keyword, volume: 0, difficulty: 0, intent, enriched: false };
  }
}

function parseGroups(raw: string | undefined | null): KeywordGroup[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function flattenSubkeywords(groups: KeywordGroup[]): Subkeyword[] {
  return groups.flatMap((g) => g.subkeywords);
}

function totalCount(groups: KeywordGroup[]): number {
  return flattenSubkeywords(groups).length;
}

async function saveCustomGroups(recordId: string, groups: KeywordGroup[]) {
  await airtablePatch(TABLE, recordId, { custom_keyword_groups: JSON.stringify(groups) });
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

    const customGroups = parseGroups(client.fields.custom_keyword_groups);
    const aiGroups = parseGroups(client.fields.keyword_groups);

    // ── createGroup ────────────────────────────────────────────────────────────
    if (action === "createGroup") {
      const groupName = (body.groupName as string)?.trim();
      if (!groupName || groupName.length > 60) {
        return NextResponse.json({ error: "Group name must be 1-60 characters" }, { status: 400 });
      }
      const allNames = [...aiGroups, ...customGroups].map((g) => g.group.toLowerCase());
      if (allNames.includes(groupName.toLowerCase())) {
        return NextResponse.json({ error: "A group with that name already exists" }, { status: 409 });
      }
      customGroups.push({ group: groupName, description: "", subkeywords: [] });
      await saveCustomGroups(client.id, customGroups);
      return NextResponse.json({ ok: true });
    }

    // ── deleteGroup ────────────────────────────────────────────────────────────
    if (action === "deleteGroup") {
      const groupName = (body.groupName as string)?.trim();
      if (!groupName) return NextResponse.json({ error: "groupName required" }, { status: 400 });
      const before = customGroups.length;
      const updated = customGroups.filter((g) => g.group !== groupName);
      if (updated.length === before) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      await saveCustomGroups(client.id, updated);
      return NextResponse.json({ ok: true });
    }

    // ── renameGroup ────────────────────────────────────────────────────────────
    if (action === "renameGroup") {
      const oldName = (body.oldName as string)?.trim();
      const newName = (body.newName as string)?.trim();
      if (!oldName || !newName || newName.length > 60) {
        return NextResponse.json({ error: "oldName and newName required, max 60 chars" }, { status: 400 });
      }
      const allNames = [...aiGroups, ...customGroups]
        .map((g) => g.group.toLowerCase())
        .filter((n) => n !== oldName.toLowerCase());
      if (allNames.includes(newName.toLowerCase())) {
        return NextResponse.json({ error: "A group with that name already exists" }, { status: 409 });
      }

      // Try custom groups first
      const customTarget = customGroups.find((g) => g.group === oldName);
      if (customTarget) {
        customTarget.group = newName;
        await saveCustomGroups(client.id, customGroups);
        return NextResponse.json({ ok: true, source: "custom" });
      }

      // Try AI groups
      const aiTarget = aiGroups.find((g) => g.group === oldName);
      if (aiTarget) {
        aiTarget.group = newName;
        await airtablePatch(TABLE, client.id, { keyword_groups: JSON.stringify(aiGroups) });
        return NextResponse.json({ ok: true, source: "ai" });
      }

      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // ── add ────────────────────────────────────────────────────────────────────
    if (action === "add") {
      const keyword = (body.keyword as string)?.trim();
      const targetGroupName = (body.groupName as string)?.trim();

      if (!keyword || keyword.length > 100) {
        return NextResponse.json({ error: "Keyword must be 1-100 characters" }, { status: 400 });
      }

      if (targetGroupName) {
        // Find the group in AI or custom
        const aiTarget = aiGroups.find((g) => g.group === targetGroupName);
        if (aiTarget) {
          if (flattenSubkeywords(aiGroups).some((kw) => kw.keyword.toLowerCase() === keyword.toLowerCase())) {
            return NextResponse.json({ error: "Keyword already in this group" }, { status: 409 });
          }
          const enriched = await enrichKeyword(keyword);
          aiTarget.subkeywords.push(enriched);
          await airtablePatch(TABLE, client.id, { keyword_groups: JSON.stringify(aiGroups) });
          return NextResponse.json({ ok: true, ...enriched });
        }

        const customTarget = customGroups.find((g) => g.group === targetGroupName);
        if (customTarget) {
          if (flattenSubkeywords(customGroups).some((kw) => kw.keyword.toLowerCase() === keyword.toLowerCase())) {
            return NextResponse.json({ error: "Keyword already in this group" }, { status: 409 });
          }
          if (totalCount(customGroups) >= MAX_CUSTOM_KEYWORDS) {
            return NextResponse.json({ error: `Maximum ${MAX_CUSTOM_KEYWORDS} keywords reached` }, { status: 400 });
          }
          const enriched = await enrichKeyword(keyword);
          customTarget.subkeywords.push(enriched);
          await saveCustomGroups(client.id, customGroups);
          return NextResponse.json({ ok: true, ...enriched });
        }

        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      // No groupName — legacy path (shouldn't be used now but keep as fallback)
      if (flattenSubkeywords(customGroups).some((kw) => kw.keyword.toLowerCase() === keyword.toLowerCase())) {
        return NextResponse.json({ error: "Keyword already added" }, { status: 409 });
      }
      if (totalCount(customGroups) >= MAX_CUSTOM_KEYWORDS) {
        return NextResponse.json({ error: `Maximum ${MAX_CUSTOM_KEYWORDS} keywords reached` }, { status: 400 });
      }
      const enriched = await enrichKeyword(keyword);
      customGroups.push({ group: "My Keywords", description: "", subkeywords: [enriched] });
      await saveCustomGroups(client.id, customGroups);
      return NextResponse.json({ ok: true, ...enriched });
    }

    // ── edit ───────────────────────────────────────────────────────────────────
    if (action === "edit") {
      const oldKeyword = (body.oldKeyword as string)?.trim();
      const newKeyword = (body.newKeyword as string)?.trim();

      if (!oldKeyword || !newKeyword || newKeyword.length > 100) {
        return NextResponse.json({ error: "Both keywords required, max 100 chars" }, { status: 400 });
      }

      let found = false;

      for (const group of customGroups) {
        for (let i = 0; i < group.subkeywords.length; i++) {
          if (group.subkeywords[i].keyword.toLowerCase() === oldKeyword.toLowerCase()) {
            group.subkeywords[i] = await enrichKeyword(newKeyword);
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (found) {
        await saveCustomGroups(client.id, customGroups);
        const updated = flattenSubkeywords(customGroups).find((kw) => kw.keyword.toLowerCase() === newKeyword.toLowerCase());
        return NextResponse.json({ ok: true, keyword: newKeyword, volume: updated?.volume ?? 0, difficulty: updated?.difficulty ?? 0, intent: updated?.intent ?? "" });
      }

      for (const group of aiGroups) {
        for (let i = 0; i < group.subkeywords.length; i++) {
          if (group.subkeywords[i].keyword.toLowerCase() === oldKeyword.toLowerCase()) {
            group.subkeywords[i] = await enrichKeyword(newKeyword);
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) return NextResponse.json({ error: "Keyword not found" }, { status: 404 });

      await airtablePatch(TABLE, client.id, { keyword_groups: JSON.stringify(aiGroups) });
      const updated = flattenSubkeywords(aiGroups).find((kw) => kw.keyword.toLowerCase() === newKeyword.toLowerCase());
      return NextResponse.json({ ok: true, keyword: newKeyword, volume: updated?.volume ?? 0, difficulty: updated?.difficulty ?? 0, intent: updated?.intent ?? "" });
    }

    // ── remove ─────────────────────────────────────────────────────────────────
    if (action === "remove") {
      const keyword = (body.keyword as string)?.trim();
      if (!keyword) return NextResponse.json({ error: "Keyword required" }, { status: 400 });

      const customBefore = totalCount(customGroups);
      for (const group of customGroups) {
        group.subkeywords = group.subkeywords.filter((kw) => kw.keyword.toLowerCase() !== keyword.toLowerCase());
      }

      if (totalCount(customGroups) < customBefore) {
        await saveCustomGroups(client.id, customGroups);
        return NextResponse.json({ ok: true });
      }

      const aiBefore = flattenSubkeywords(aiGroups).length;
      for (const group of aiGroups) {
        group.subkeywords = group.subkeywords.filter((kw) => kw.keyword.toLowerCase() !== keyword.toLowerCase());
      }

      if (flattenSubkeywords(aiGroups).length < aiBefore) {
        await airtablePatch(TABLE, client.id, { keyword_groups: JSON.stringify(aiGroups) });
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
    }

    // ── priority ───────────────────────────────────────────────────────────────
    if (action === "priority") {
      const keyword = (body.keyword as string)?.trim();
      const priority = body.priority as "high" | "medium" | "low";

      if (!keyword || !["high", "medium", "low"].includes(priority)) {
        return NextResponse.json({ error: "Keyword and valid priority required" }, { status: 400 });
      }

      let found = false;
      for (const group of customGroups) {
        for (let i = 0; i < group.subkeywords.length; i++) {
          if (group.subkeywords[i].keyword.toLowerCase() === keyword.toLowerCase()) {
            group.subkeywords[i].priority = priority;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (found) {
        await saveCustomGroups(client.id, customGroups);
        return NextResponse.json({ ok: true, source: "custom" });
      }

      for (const group of aiGroups) {
        for (let i = 0; i < group.subkeywords.length; i++) {
          if (group.subkeywords[i].keyword.toLowerCase() === keyword.toLowerCase()) {
            group.subkeywords[i].priority = priority;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (found) {
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
