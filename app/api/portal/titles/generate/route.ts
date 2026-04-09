import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClientByToken } from "@/lib/clients";

export const dynamic = "force-dynamic";

const client = new Anthropic();

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
    content_tone?: string;
    content_audience?: string;
  };

  const { current_title, suggestion, keyword, group, content_tone, content_audience } = body;

  if (!suggestion?.trim()) {
    return NextResponse.json({ error: "suggestion required" }, { status: 400 });
  }

  const tone = content_tone || portalClient.fields.content_tone || "Healthcare";
  const audience = content_audience || portalClient.fields.content_audience || "general audience";

  const prompt = `You are an SEO content strategist. Generate ONE improved blog post title based on the following:

Current title: ${current_title || "(none)"}
Target keyword: ${keyword || "(not specified)"}
Keyword group / topic pillar: ${group || "(not specified)"}
Content tone: ${tone}
Target audience: ${audience}
Client suggestion / direction: ${suggestion}

Rules:
- 8–15 words
- Specific angle, not generic
- Do NOT use: "Complete Guide", "Everything You Need to Know", "Ultimate Guide", "Why [Topic] Matters"
- Match the ${tone} tone
- The title must incorporate the client's suggestion direction
- No markdown, no quotes, no explanation — output ONLY the title text itself`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [{ role: "user", content: prompt }],
  });

  const generated = (message.content[0] as { type: string; text: string }).text?.trim() ?? "";

  return NextResponse.json({ title: generated });
}
