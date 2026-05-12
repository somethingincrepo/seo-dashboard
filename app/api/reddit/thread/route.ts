import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#32;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "");
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseRedditRss(xml: string): {
  selftext: string;
  comments: Array<{ author: string; body: string; score: number }>;
} | null {
  // Split into entries
  const entryMatches = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  if (entryMatches.length === 0) return null;

  function extractEntry(raw: string) {
    const authorMatch = raw.match(/<name>([^<]+)<\/name>/);
    const author = (authorMatch?.[1] ?? "unknown").replace(/^\/u\//, "");

    // Content is HTML-encoded inside the content tag
    const contentStart = raw.indexOf('<content type="html">') + '<content type="html">'.length;
    const contentEnd = raw.lastIndexOf("</content>");
    if (contentStart <= 0 || contentEnd <= 0) return { author, body: "" };

    const encodedHtml = raw.slice(contentStart, contentEnd);
    // First decode the outer entity encoding, then strip the inner HTML tags
    const decodedHtml = decodeHtmlEntities(encodedHtml);
    // Strip the "submitted by" footer that Reddit appends
    const bodyPart = decodedHtml.split(/submitted by/i)[0].trim();
    const body = stripHtml(bodyPart);
    return { author, body };
  }

  const [postEntry, ...commentEntries] = entryMatches.map(m => extractEntry(m[1]));

  const comments = commentEntries
    .filter(c => c.body && c.body.length > 0)
    .slice(0, 5)
    .map(c => ({ author: c.author, body: c.body.slice(0, 600), score: 0 }));

  return {
    selftext: postEntry.body.slice(0, 2000),
    comments,
  };
}

export async function GET(request: NextRequest) {
  const permalink = request.nextUrl.searchParams.get("permalink");
  if (!permalink) return NextResponse.json({ error: "permalink required" }, { status: 400 });

  // Build RSS URL: strip query params and trailing slash, append .rss
  const cleanUrl = permalink.replace(/[?#].*$/, "").replace(/\/$/, "");
  const rssUrl = `${cleanUrl}.rss`;

  try {
    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/atom+xml, text/xml, */*",
      },
      // 10-second timeout
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Reddit returned ${res.status}` }, { status: res.status });
    }

    const xml = await res.text();
    const parsed = parseRedditRss(xml);

    if (!parsed) {
      return NextResponse.json({ error: "Could not parse Reddit feed" }, { status: 500 });
    }

    // Extract title from XML
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : "";

    return NextResponse.json({
      title,
      selftext: parsed.selftext,
      comments: parsed.comments,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
