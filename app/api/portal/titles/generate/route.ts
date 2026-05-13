import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClientByToken } from "@/lib/clients";
import { requirePortalAuth } from "@/lib/portal-auth";
import { contentAirtableFetch, escapeAirtableString } from "@/lib/airtable";
import { buildStylesPromptBlock, parseStyles } from "@/lib/content-styles";

export const dynamic = "force-dynamic";

// OpenRouter via Anthropic SDK — see lib/agent-runner.ts for the same pattern.
const anthropic = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api",
  defaultHeaders: {
    "HTTP-Referer": process.env.PUBLIC_BASE_URL ?? "https://app.seoguru.ai",
    "X-Title": "seo-dashboard:titles",
  },
});

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
    content_type_name?: "standard" | "longform";
  };

  const { current_title, suggestion, keyword, group, search_intent, content_type_name } = body;
  const isLongform = content_type_name === "longform";
  if (!suggestion?.trim()) return NextResponse.json({ error: "suggestion required" }, { status: 400 });

  const companyName = portalClient.fields.company_name;
  const siteUrl = portalClient.fields.site_url || "";
  const tone = portalClient.fields.content_tone || "";
  const audience = portalClient.fields.content_audience || "";
  const isLocal = portalClient.fields.is_local_business === true;
  const serviceAreas = (portalClient.fields.service_areas || "").trim();

  // Fetch content profile for brand voice, positioning, services, restricted language, and content styles
  let brandVoice = "";
  let positioning = "";
  let coreServices = "";
  let restrictedLanguage = "";
  let stylesBlock = "";

  try {
    const records = await contentAirtableFetch<{
      id: string;
      fields: Record<string, string>;
    }>("Clients", { filterByFormula: `{Client Name}="${escapeAirtableString(companyName)}"` });

    if (records.length) {
      const f = records[0].fields;
      brandVoice = f["Brand voice summary"] ?? "";
      positioning = f["Positioning/differentiators"] ?? "";
      coreServices = f["Core products/services"] ?? "";
      restrictedLanguage = f["Restricted claims/language"] ?? "";
      stylesBlock = buildStylesPromptBlock(parseStyles(f["Content styles"]));
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
${stylesBlock ? `\n${stylesBlock}\n` : ""}
CONTENT TYPE: ${isLongform ? "Long-Form Guide (3,000–5,000 words)" : "Standard Article (1,500–2,500 words)"}
CURRENT TITLE: ${current_title || "(none)"}
TARGET KEYWORD: ${keyword || "(not specified)"}
KEYWORD GROUP / TOPIC PILLAR: ${group || "(not specified)"}
SEARCH INTENT: ${search_intent || "(not specified)"}
LOCAL BUSINESS: ${isLocal ? "yes" : "no"}
SERVICE AREAS: ${serviceAreas || "(none)"}

CLIENT DIRECTION / SUGGESTION: ${suggestion}

Rules:
- 8–15 words
- Specific and concrete
- Matches the ${tone || "professional"} tone
- Does NOT violate restricted language
- Does NOT use: "Everything You Need to Know", "Ultimate Guide", "Why X Matters"
${isLocal && serviceAreas
  ? `- This client is a LOCAL business — about half the time include a real city/region from SERVICE AREAS to signal local intent (patterns like "in [City]", "[Area] [Service]", "Near [Region]"); the other half write a pure topic title with no geo. Never invent a city — only use names from SERVICE AREAS.`
  : `- This client is NOT local — never include city, region, or "near me" modifiers in the title.`}
${isLongform ? `- This is a LONG-FORM GUIDE — the title must signal depth and comprehensiveness
- Use formats like: "How to [X]: A Step-by-Step Guide", "[Topic]: A Complete Walkthrough", "The [X] Guide for [Audience]", "[X] Explained: [Specific Angle]", "How to [X] (and [Related Thing])"
- The word "Guide" is encouraged for long-form — but avoid "Ultimate Guide" or "Complete Guide"
- Avoid formats that sound like short blog posts or quick tips` : `- This is a STANDARD ARTICLE — keep the title focused and direct, not a guide or how-to series
- Avoid "guide", "walkthrough", "complete", or other signals of deep-dive content`}
- If search intent is "informational", write a title that educates or answers a question
- If search intent is "commercial", write a title that helps someone compare or evaluate options
- If search intent is "transactional", write a title that drives action or a decision
- If the direction and keyword don't perfectly align, lean toward the direction and use the keyword as context only

Output ONLY the title text. No quotes, no markdown, no explanation, no commentary.`;

  const message = await anthropic.messages.create({
    model: "anthropic/claude-sonnet-4.6",
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
