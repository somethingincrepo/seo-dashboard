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
    search_intent?: string;
  };

  const { current_title, suggestion, keyword, group, search_intent } = body;
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

  const prompt = `CLIENT: ${companyName}
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
SEARCH INTENT: ${search_intent || "(not specified)"}

CLIENT DIRECTION / SUGGESTION: ${suggestion}

Rules:
- 8–15 words
- Specific and concrete
- Matches the ${tone || "professional"} tone
- Does NOT violate restricted language
- Does NOT use: "Complete Guide", "Everything You Need to Know", "Ultimate Guide", "Why X Matters"
- If search intent is "informational", write a title that educates or answers a question
- If search intent is "commercial", write a title that helps someone compare or evaluate options
- If search intent is "transactional", write a title that drives action or a decision
- If the direction and keyword don't perfectly align, lean toward the direction and use the keyword as context only

Output ONLY the title text. No quotes, no markdown, no explanation, no commentary.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 120,
    system: "You are a blog title writer. You ALWAYS output exactly one blog post title and nothing else — no explanations, no refusals, no commentary, no punctuation other than what belongs in the title itself. If inputs seem mismatched, do your best with what you have and write a title anyway.",
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text?.trim() ?? "";
  // Take only the first line in case the model outputs multiple lines
  const generated = raw
    .split("\n")[0]
    .trim()
    .replace(/^["']|["']$/g, "");

  return NextResponse.json({ title: generated });
}
