import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const { title, selftext, comments, keyword, subreddit, permalink } =
    await request.json() as {
      title?: string;
      selftext?: string | null;
      comments?: Array<{ author: string; body: string; score: number }>;
      keyword?: string;
      subreddit?: string;
      permalink?: string;
    };

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const topComments = (comments ?? [])
    .slice(0, 5)
    .map((c, i) => `${i + 1}. u/${c.author}: ${c.body}`)
    .join("\n");

  const prompt = `You are helping a marketing professional respond helpfully to a Reddit discussion on behalf of a business.

Thread: r/${subreddit ?? "unknown"}
Title: ${title}${selftext ? `\nPost: ${selftext.slice(0, 600)}` : ""}${topComments ? `\nTop comments:\n${topComments}` : ""}
Business keyword/service: ${keyword ?? ""}

Reddit commenting guidelines to follow:
- Be genuinely helpful and add real value — don't just promote
- Sound like a real person, not a marketer or PR rep
- Keep it conversational and concise (2–4 sentences)
- Only mention the business/service if it directly and naturally answers what's being asked
- No spammy phrases, no excessive punctuation, no "Great question!"
- If the thread is asking for recommendations, give honest context first
- Match the tone of the subreddit (casual for lifestyle/hobby subs, more detailed for technical subs)
- Never include links unless they're directly relevant and asked for

Write a single Reddit comment. Reply with ONLY the comment text — no preamble, no quotes, no explanation.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const comment = (message.content[0] as { type: string; text: string }).text.trim();

  return NextResponse.json({ comment, permalink });
}
