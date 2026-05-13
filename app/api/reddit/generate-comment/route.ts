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

    const businessContext = clientName
      ? `You are posting as someone who works at ${clientName}, a business that specialises in: ${keyword ?? "this area"}.`
      : `You are posting as someone knowledgeable about: ${keyword ?? "this topic"}.`;

    const disclosureNote = clientName
      ? `If you mention ${clientName}, disclose it in the first sentence with something like "I'm at ${clientName}, so take this with a grain of salt, but..." or "Heads up, I'm with ${clientName} — that said..." Never bury the disclosure at the end. Never say "I work with". Say "I'm at" or "I'm with".`
      : `Do not mention any company or product.`;

    const prompt = isRefine
      ? `Revise this Reddit comment. Keep the core point but improve it.

Rules:
- No em dashes. Use commas or parentheses instead.
- No corporate words: no "seamless", "innovative", "game-changing", "cutting-edge", "transformative"
- No openers like "Great question", "Absolutely", "Certainly", "I'd be happy to"
- No closing summary
- Take a clear position — don't hedge everything
- Tone: ${toneGuide.toLowerCase()}
- Length: ${lengthGuide}

Original:
${existingDraft}

Thread: r/${subreddit ?? "unknown"} — "${title}"

Reply with ONLY the revised comment. No preamble, no quotes.`
      : `Write a Reddit comment for this thread. ${businessContext}

Thread: r/${subreddit ?? "unknown"}
Title: ${title}${selftext ? `\nPost body: ${selftext.slice(0, 800)}` : ""}${topComments ? `\nTop comments:\n${topComments}` : ""}

Tone: ${toneGuide}
Length: ${lengthGuide}

Hard rules — break any of these and it will fail:
1. No em dashes. Use commas or parentheses instead.
2. No corporate adjectives: "seamless", "innovative", "game-changing", "cutting-edge", "revolutionary", "transformative", "best-in-class"
3. No AI tells: "Great question", "Absolutely", "Certainly", "I'd be happy to", "I hope this helps", "It's worth noting", "Additionally", "Furthermore"
4. No closing summary. Stop when you've made your point.
5. ${disclosureNote}
6. If mentioning ${clientName ?? "the business"}, acknowledge one real limitation or name a competitor that's also worth considering — this is what makes it credible
7. The comment must contain genuinely useful advice that would stand on its own even without any brand mention
8. No call to action. No "check us out", "try it free", "visit our site"
9. Reference something specific from this thread — do not write a generic answer that could fit any post
10. Write like a person talking to another person, not a brand talking to a customer. Use contractions. Take a side.

Reply with ONLY the comment text. No preamble, no quotes, no explanation.`;

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
