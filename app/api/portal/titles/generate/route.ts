import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClientByToken } from "@/lib/clients";
import { contentAirtableFetch } from "@/lib/airtable";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const portalClient = await getClientByToken(token);
  if (!portalClient) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as {
    current_title?: string;
    suggestion?: string;
    keyword?: string;
    group?: string;
  };

  const { current_title, suggestion, keyword, group } = body;
  if (!suggestion?.trim()) return NextResponse.json({ error: "suggestion required" }, { status: 400 });

  const companyName = portalClient.fields.company_name;
  const siteUrl = portalClient.fields.site_url || "";
  const tone = portalClient.fields.content_tone || "";
  const audience = portalClient.fields.content_audience || "";

  // Fetch content profile for brand voice, positioning, services, restricted language
  let brandVoice = "";
  let positioning = "";
  let coreServices = "";
  let restrictedLanguage = "";

  try {
    const records = await contentAirtableFetch<{
      id: string;
      fields: Record<string, string>;
    }>("Clients", { filterByFormula: `{Client Name}="${companyName}"` });

    if (records.length) {
      const f = records[0].fields;
      brandVoice = f["Brand voice summary"] ?? "";
      positioning = f["Positioning/differentiators"] ?? "";
      coreServices = f["Core products/services"] ?? "";
      restrictedLanguage = f["Restricted claims/language"] ?? "";
    }
  } catch { /* non-fatal — continue without profile */ }

  const prompt = `You are an SEO content strategist writing blog titles for a specific client. You must write a title that is unmistakably about THIS client and their specific business — not a generic title that any company could use.

CLIENT: ${companyName}
WEBSITE: ${siteUrl}
INDUSTRY TONE: ${tone || "professional"}
TARGET AUDIENCE: ${audience || "their customers"}

CONTENT PROFILE:
Brand voice: ${brandVoice || "(not set)"}
What makes them different: ${positioning || "(not set)"}
Core services/products: ${coreServices || "(not set)"}
Restricted language (NEVER use): ${restrictedLanguage || "(none specified)"}

CURRENT TITLE: ${current_title || "(none)"}
TARGET KEYWORD: ${keyword || "(not specified)"}
KEYWORD GROUP / TOPIC PILLAR: ${group || "(not specified)"}

CLIENT DIRECTION / SUGGESTION: ${suggestion}

YOUR TASK:
Generate ONE improved blog post title that:
1. Directly incorporates the client's direction above
2. Targets the keyword "${keyword || "the topic"}" naturally
3. Reflects ${companyName}'s specific brand voice and differentiators — not generic advice
4. Is 8–15 words
5. Is specific and concrete — a reader should immediately know what they'll learn
6. Matches the ${tone || "professional"} tone
7. Does NOT violate any restricted language rules
8. Does NOT use: "Complete Guide", "Everything You Need to Know", "Ultimate Guide", "Why X Matters"

Output ONLY the title text. No quotes, no markdown, no explanation.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  });

  const generated = (message.content[0] as { type: string; text: string }).text
    ?.trim()
    .replace(/^["']|["']$/g, "") // strip any quotes the model adds
    ?? "";

  return NextResponse.json({ title: generated });
}
