import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { title, selftext, comments, keyword, subreddit, permalink, clientName, tone, length, existingDraft } =
      await request.json() as {
        title?: string;
        selftext?: string | null;
        comments?: Array<{ author: string; body: string; score: number }>;
        keyword?: string;
        subreddit?: string;
        permalink?: string;
        clientName?: string;
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

    const businessLine = clientName
      ? `Business name: ${clientName}\nRelevant service/keyword: ${keyword ?? ""}`
      : `Relevant service/keyword: ${keyword ?? ""}`;

    const prompt = isRefine
      ? `Refine this Reddit comment to be more ${toneGuide.toLowerCase()} and ${lengthGuide} long. Keep the core message, naturally mention "${clientName ?? keyword ?? "the business"}" if relevant, and improve clarity. Reply with ONLY the revised comment text.

Original comment:
${existingDraft}

Thread context: r/${subreddit ?? "unknown"} — "${title}"`
      : `You are writing a Reddit comment on behalf of a business, responding to a relevant thread where the business could add value.

Thread: r/${subreddit ?? "unknown"}
Title: ${title}${selftext ? `\nPost: ${selftext.slice(0, 800)}` : ""}${topComments ? `\nTop comments:\n${topComments}` : ""}
${businessLine}
Tone: ${toneGuide}
Length: ${lengthGuide}

Instructions:
- Write as if you are a knowledgeable person associated with ${clientName ?? "the business"} — helpful, not salesy
- Naturally mention ${clientName ? `"${clientName}"` : "the business by name"} once if it genuinely answers what's being asked (e.g. "We've helped clients with this at ${clientName ?? "our company"}..." or "I work with ${clientName ?? "a company"} that specialises in this...")
- Add real value — specific insight, a tip, or direct answer to the question
- Sound like a real person on Reddit, not marketing copy
- No links, no promotional language, no "Great question!"
- Match the casual tone of Reddit — contractions, natural phrasing
- ${lengthGuide} total

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
        max_tokens: 600,
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
