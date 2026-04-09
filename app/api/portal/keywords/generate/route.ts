import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClientByToken } from "@/lib/clients";
import { contentAirtableFetch } from "@/lib/airtable";
import { airtablePatch } from "@/lib/airtable";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

type GeneratedGroup = {
  group: string;
  description: string;
  subkeywords: { keyword: string; volume: number; difficulty: number; intent: string; priority: string }[];
};

function inferIntent(keyword: string): string {
  const kw = keyword.toLowerCase();
  if (/pricing|price|\bcost\b|\bbuy\b|near me|\bdemo\b|\bquote\b|\bhire\b|\bbook\b/.test(kw)) return "transactional";
  if (/\bvs\b|versus|alternative|compare|difference/.test(kw)) return "commercial";
  if (/^how |^why |^what |^when |^where |\bbest |\btop |\breview/.test(kw)) return "informational";
  return "informational";
}

async function enrichKeyword(keyword: string, auth: string): Promise<{ volume: number; difficulty: number; intent: string }> {
  try {
    const volRes = await fetch("https://api.dataforseo.com/v3/keywords_data/google/search_volume/live", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keywords: [keyword], location_code: 2840, language_code: "en" }]),
    });

    let volume = 0;
    let difficulty = 0;
    let intent = inferIntent(keyword);

    if (volRes.ok) {
      type DfsVol = { tasks?: Array<{ result?: Array<Record<string, unknown>> }> };
      const volData = await volRes.json() as DfsVol;
      const r = volData.tasks?.[0]?.result?.[0];
      if (typeof r?.search_volume === "number") volume = r.search_volume;
    }

    const kdRes = await fetch("https://api.dataforseo.com/v3/keywords_data/google/keywords/live", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keywords: [keyword], location_code: 2840, language_code: "en" }]),
    });

    if (kdRes.ok) {
      type DfsKd = { tasks?: Array<{ result?: Array<{ items?: Record<string, unknown>[] }> }> };
      const kdData = await kdRes.json() as DfsKd;
      const items = kdData.tasks?.[0]?.result?.[0]?.items;
      if (items?.length) {
        const ki = items[0].keyword_info as Record<string, unknown> | undefined;
        const si = items[0].search_intent_info as Record<string, unknown> | undefined;
        difficulty = Math.max(0, Math.min(100, (ki?.keyword_difficulty as number) ?? 0));
        intent = (si?.main_intent as string) ?? intent;
      }
    }

    return { volume, difficulty, intent };
  } catch {
    return { volume: 0, difficulty: 0, intent: inferIntent(keyword) };
  }
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as { suggestion?: string; save?: boolean; group?: GeneratedGroup };
  const { suggestion, save, group: groupToSave } = body;

  // ── SAVE path — called after user approves the preview ────────────────────
  if (save && groupToSave) {
    const existing: GeneratedGroup[] = (() => {
      try { return client.fields.custom_keyword_groups ? JSON.parse(client.fields.custom_keyword_groups) : []; }
      catch { return []; }
    })();
    const merged = [...existing, groupToSave];
    await airtablePatch("Clients", client.id, { custom_keyword_groups: JSON.stringify(merged) });
    return NextResponse.json({ ok: true });
  }

  // ── GENERATE path ─────────────────────────────────────────────────────────
  if (!suggestion?.trim()) return NextResponse.json({ error: "suggestion required" }, { status: 400 });

  const companyName = client.fields.company_name || "";
  const siteUrl = client.fields.site_url || "";
  const tone = client.fields.content_tone || "";
  const audience = client.fields.content_audience || "";

  // Existing keyword groups — avoid duplication
  const existingGroups: GeneratedGroup[] = (() => {
    try {
      const ai = client.fields.keyword_groups ? JSON.parse(client.fields.keyword_groups) : [];
      const custom = client.fields.custom_keyword_groups ? JSON.parse(client.fields.custom_keyword_groups) : [];
      return [...ai, ...custom];
    } catch { return []; }
  })();
  const existingGroupNames = existingGroups.map((g: GeneratedGroup) => g.group).join(", ");

  // Content profile for context
  let brandVoice = "", coreServices = "";
  try {
    const records = await contentAirtableFetch<{ id: string; fields: Record<string, string> }>(
      "Clients", { filterByFormula: `{Client Name}="${companyName}"` }
    );
    if (records.length) {
      brandVoice = records[0].fields["Brand voice summary"] ?? "";
      coreServices = records[0].fields["Core products/services"] ?? "";
    }
  } catch { /* non-fatal */ }

  const prompt = `You are an SEO keyword strategist. Generate exactly ONE keyword group for a specific client's content strategy.

CLIENT: ${companyName}
WEBSITE: ${siteUrl}
TONE: ${tone || "professional"}
AUDIENCE: ${audience || "their customers"}
CORE SERVICES: ${coreServices || "(not set)"}
BRAND VOICE: ${brandVoice || "(not set)"}

EXISTING GROUPS (do NOT duplicate): ${existingGroupNames || "none"}

CLIENT DIRECTION: ${suggestion}

Generate exactly ONE keyword group with exactly 5 subkeywords. The group should:
- Target a distinct topic pillar not already covered in existing groups
- Have a descriptive name (topic phrase, not a single keyword)
- Include exactly 5 specific subkeywords ranked by opportunity (volume × inverse difficulty)
- Mix intents: informational + commercial or transactional

For each subkeyword, infer search intent: "informational", "commercial", or "transactional"

Respond with ONLY a valid JSON object (not an array), no markdown, no explanation:
{
  "group": "Group Name",
  "description": "One sentence describing this topic pillar and who it targets",
  "subkeywords": [
    { "keyword": "exact keyword phrase", "intent": "informational" },
    { "keyword": "exact keyword phrase", "intent": "commercial" },
    { "keyword": "exact keyword phrase", "intent": "informational" },
    { "keyword": "exact keyword phrase", "intent": "informational" },
    { "keyword": "exact keyword phrase", "intent": "commercial" }
  ]
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text?.trim() ?? "";

  let group: GeneratedGroup;
  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as GeneratedGroup | GeneratedGroup[];
    // Accept either a single object or an array (take first element)
    group = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!group?.group || !Array.isArray(group.subkeywords)) throw new Error("invalid shape");
    // Ensure exactly 5 subkeywords
    group.subkeywords = group.subkeywords.slice(0, 5);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw }, { status: 500 });
  }

  // Enrich all 5 subkeywords in parallel if DataForSEO is configured
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (login && password) {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    await Promise.all(
      group.subkeywords.map(async (sk) => {
        const enriched = await enrichKeyword(sk.keyword, auth);
        sk.volume = enriched.volume;
        sk.difficulty = enriched.difficulty;
        sk.intent = enriched.intent || sk.intent;
      })
    );
  } else {
    group.subkeywords.forEach((sk) => { sk.volume = 0; sk.difficulty = 0; });
  }

  // Assign priority: rank 1 → high, ranks 2–3 → medium, ranks 4–5 → low
  group.subkeywords.forEach((sk, i) => {
    sk.priority = i === 0 ? "high" : i < 3 ? "medium" : "low";
  });

  return NextResponse.json({ group });
}
