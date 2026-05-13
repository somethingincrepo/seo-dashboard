import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { title, selftext, comments, keyword, subreddit, permalink, tone, length, existingDraft } =
      await request.json() as {
        title?: string;
        selftext?: string | null;
        comments?: Array<{ author: string; body: string; score: number }>;
        keyword?: string;
        subreddit?: string;
        permalink?: string;
        tone?: string;
        length?: string;
        existingDraft?: string;
      };

    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const topComments = (comments ?? [])
      .slice(0, 5)
      .map((c, i) => `${i + 1}. u/${c.author}: ${c.body}`)
      .join("\n");

    const lengthGuide = length === "Short" ? "1–2 sentences" : length === "Long" ? "4–6 sentences" : "2–4 sentences";
    const toneGuide = tone ?? "Helpful";
    const isRefine = !!existingDraft;

    const prompt = isRefine
      ? `Refine this Reddit comment to be more ${toneGuide.toLowerCase()} and ${lengthGuide} long. Keep the core message but improve the tone and clarity. Reply with ONLY the revised comment text.

Original comment:
${existingDraft}

Thread context: r/${subreddit ?? "unknown"} — "${title}"`
      : `You are helping a marketing professional respond helpfully to a Reddit discussion on behalf of a business.

Thread: r/${subreddit ?? "unknown"}
Title: ${title}${selftext ? `\nPost: ${selftext.slice(0, 600)}` : ""}${topComments ? `\nTop comments:\n${topComments}` : ""}
Business keyword/service: ${keyword ?? ""}
Tone: ${toneGuide}
Length: ${lengthGuide}

Reddit commenting guidelines:
- Be genuinely helpful and add real value — don't just promote
- Sound like a real person, not a marketer or PR rep
- Keep it ${toneGuide.toLowerCase()} and ${lengthGuide}
- Only mention the business/service if it directly and naturally answers what's being asked
- No spammy phrases, no "Great question!", no excessive punctuation
- Match the tone of the subreddit
- Never include links unless directly relevant and asked for

Write a single Reddit comment. Reply with ONLY the comment text — no preamble, no quotes, no explanation.`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/somethingincrepo/seo-dashboard",
        "X-Title": "SEO Dashboard",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) throw new Error(`OpenRouter error: ${resp.status}`);
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const comment = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!comment) throw new Error("No response from model");

    return NextResponse.json({ comment, permalink });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-comment]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
