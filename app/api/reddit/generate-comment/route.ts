import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { title, selftext, comments, keyword, subreddit, permalink, clientName, tone, length, perspective, existingDraft } =
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
        perspective?: string;
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

    const toneInstructions: Record<string, string> = {
      Helpful:      "Direct and practical. Answer the question clearly, give a specific tip or recommendation, no fluff.",
      Professional: "Measured and considered. Sound like someone with real industry experience — precise language, acknowledges nuance, not a cheerleader.",
      Casual:       "Conversational and relaxed. Short sentences, contractions, 'tbh' or 'honestly' are fine. Sounds like a text message, not an email.",
      Friendly:     "Warm and encouraging. Empathetic to what they're dealing with. Still useful, but the tone is supportive rather than clinical.",
      Expert:       "Goes one level deeper than most comments. Specific detail, technical accuracy, references the kind of thing only someone with real experience would know.",
    };

    const toneInstruction = toneInstructions[toneGuide] ?? toneInstructions.Helpful;

    // Perspective controls HOW the brand is mentioned (or not)
    const brand = clientName ?? keyword ?? "the business";
    let perspectiveNote: string;

    if (!clientName || perspective === "No Brand") {
      perspectiveNote = `Do not mention any company, product, or brand. Be purely helpful — an informed person sharing experience, nothing more.`;
    } else if (perspective === "As Customer") {
      perspectiveNote = `Write as a regular person who uses ${clientName}, not as an employee. Say things like "I use ${clientName} for this" or "we've used ${clientName} and it works well" or "I switched to ${clientName} last year." Sound like a satisfied customer making a casual recommendation — not a fan, not a salesperson. You are NOT staff. Do not say "I'm at" or "I work at."`;
    } else {
      // As Employee (default)
      perspectiveNote = `Write as someone who works at ${clientName}. Disclose this in the very first sentence, briefly — something like "I'm at ${clientName} so take this with a grain of salt, but..." or "Full disclosure, I work at ${clientName} —" then move straight into being helpful. Never say "I work with." Say "I'm at" or "I work at" or "I'm with."`;
    }

    const brandNote = `${perspectiveNote}

${clientName ? `Mention ${brand} at most once. After that single mention, never bring it up again. If you mention it, also acknowledge something it doesn't do well, or name a competitor that's better for a specific use case — that's the credibility signal that makes Reddit trust the comment.` : ""}

No CTA. No "check us out", no links, no pitch, no invitation to DM.`;

    const prompt = isRefine
      ? `Revise this comment. Keep the core point, improve the writing.

Tone to hit: ${toneInstruction}
Length: ${lengthGuide}

Hard rules:
- No em dashes. Commas or parentheses only.
- No corporate words: "seamless", "innovative", "game-changing", "cutting-edge", "transformative"
- No AI tells: "Great question", "Absolutely", "Certainly", "I'd be happy to", "I hope this helps", "Additionally", "Furthermore"
- No closing summary. Stop when done.
- Take a position. Don't hedge everything.

Original:
${existingDraft}

Thread context: r/${subreddit ?? "unknown"} — "${title}"

Reply with ONLY the revised comment text.`
      : `Write a single Reddit comment responding to this thread.

Thread: r/${subreddit ?? "unknown"}
Title: ${title}${selftext ? `\nPost: ${selftext.slice(0, 800)}` : ""}${topComments ? `\nTop comments:\n${topComments}` : ""}

Tone: ${toneInstruction}
Length: ${lengthGuide}

${brandNote}

Hard rules — every single one applies:
1. No em dashes. Commas or parentheses only.
2. No corporate adjectives: "seamless", "innovative", "game-changing", "cutting-edge", "revolutionary", "best-in-class"
3. No AI tells: "Great question", "Absolutely", "Certainly", "I'd be happy to", "I hope this helps", "It's worth noting", "Additionally", "Furthermore"
4. No closing summary or sign-off. Just stop when the point is made.
5. The comment must be genuinely useful on its own. If you removed the brand mention entirely, the comment should still be worth reading.
6. If the brand comes up, also acknowledge something it doesn't do well, or mention a competitor that handles a specific thing better. That honesty is what makes people trust it.
7. No call to action whatsoever. No "check us out", "feel free to DM", "visit our site", "happy to help further".
8. Reference something specific from this thread. A generic answer that could fit any post is a failure.
9. Write like a person, not a brand. Contractions. Opinions. Take a side.

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
