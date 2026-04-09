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
  subkeywords: { keyword: string; volume: number; difficulty: number; intent: string }[];
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

  const body = await request.json() as { suggestion?: string; save?: boolean; groups?: GeneratedGroup[] };
  const { suggestion, save, groups: groupsToSave } = body;

  // ── SAVE path — called after user approves the preview ────────────────────
  if (save && groupsToSave) {
    const existing: GeneratedGroup[] = (() => {
      try { return client.fields.custom_keyword_groups ? JSON.parse(client.fields.custom_keyword_groups) : []; }
      catch { return []; }
    })();
    const merged = [...existing, ...groupsToSave];
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

  const prompt = `You are an SEO keyword strategist. Generate keyword groups for a specific client's content strategy.

CLIENT: ${companyName}
WEBSITE: ${siteUrl}
TONE: ${tone || "professional"}
AUDIENCE: ${audience || "their customers"}
CORE SERVICES: ${coreServices || "(not set)"}
BRAND VOICE: ${brandVoice || "(not set)"}

EXISTING GROUPS (do NOT duplicate): ${existingGroupNames || "none"}

CLIENT DIRECTION: ${suggestion}

Generate 3–5 keyword groups. Each group should:
- Target a distinct topic pillar with enough depth for 3–5 articles
- Have a descriptive name (topic phrase, not a single keyword)
- Include 2–3 specific subkeywords per group
- Mix intents: informational + commercial or transactional

For each subkeyword, infer search intent: "informational", "commercial", or "transactional"

Respond with ONLY valid JSON, no markdown, no explanation:
[
  {
    "group": "Group Name",
    "description": "One sentence describing this topic pillar and who it targets",
    "subkeywords": [
      { "keyword": "exact keyword phrase", "intent": "informational" }
    ]
  }
]`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text?.trim() ?? "";

  let groups: GeneratedGroup[];
  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    groups = JSON.parse(cleaned) as GeneratedGroup[];
    if (!Array.isArray(groups)) throw new Error("not array");
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw }, { status: 500 });
  }

  // Enrich all subkeywords in parallel if DataForSEO is configured
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (login && password) {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    await Promise.all(
      groups.flatMap((g) =>
        g.subkeywords.map(async (sk) => {
          const enriched = await enrichKeyword(sk.keyword, auth);
          sk.volume = enriched.volume;
          sk.difficulty = enriched.difficulty;
          sk.intent = enriched.intent || sk.intent;
        })
      )
    );
  } else {
    // No DataForSEO — fill defaults
    groups.forEach((g) => g.subkeywords.forEach((sk) => {
      sk.volume = 0;
      sk.difficulty = 0;
    }));
  }

  return NextResponse.json({ groups });
}
