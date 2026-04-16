import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";

export const dynamic = "force-dynamic";

type PageSection = {
  level: 2 | 3;
  heading: string;
  paragraphs: string[];
};

type ExtractedPage = {
  h1: string;
  metaDescription: string;
  sections: PageSection[];
  wordCount: number;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, "").trim();
}

function extractPageContent(html: string): ExtractedPage {
  // Remove scripts, styles, nav, header, footer — noise
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Meta description
  const metaMatch = cleaned.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)
    ?? cleaned.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
  const metaDescription = metaMatch ? stripTags(metaMatch[1]).substring(0, 320) : "";

  // H1
  const h1Match = cleaned.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1Match ? stripTags(h1Match[1]) : "";

  // Extract sections: split on H2/H3 boundaries
  const sections: PageSection[] = [];
  // Find all H2 and H3 with their following content
  const headingRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[1-6]|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = headingRe.exec(cleaned)) !== null) {
    const level = parseInt(match[1]) as 2 | 3;
    const heading = stripTags(match[2]);
    const sectionBody = match[3];

    if (!heading) continue;

    // Extract paragraphs and list items from section body
    const paragraphs: string[] = [];
    const pRe = /<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = pRe.exec(sectionBody)) !== null) {
      const text = stripTags(pm[1]).replace(/\s+/g, " ").trim();
      if (text.length > 20) paragraphs.push(text);
    }

    sections.push({ level, heading, paragraphs });
  }

  // Word count from the whole body text
  const allText = stripTags(cleaned).replace(/\s+/g, " ").trim();
  const wordCount = allText.split(" ").filter((w) => w.length > 1).length;

  return { h1, metaDescription, sections, wordCount };
}

// GET /api/portal/content-optimization/proxy?token=xxx&url=https://...
// Fetches the target page server-side (avoids CORS) and returns structured content
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const url = request.nextUrl.searchParams.get("url");

  if (!token || !url) {
    return NextResponse.json({ error: "Missing token or url" }, { status: 400 });
  }

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  // Basic URL validation — must be http/https
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid URL protocol" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEO-Portal/1.0; +https://somethinginc.io)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Page returned HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const content = extractPageContent(html);

    return NextResponse.json(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
