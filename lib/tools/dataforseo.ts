import type Anthropic from "@anthropic-ai/sdk";

function getAuth(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("DataForSEO credentials not configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)");
  return Buffer.from(`${login}:${password}`).toString("base64");
}

// ---------------------------------------------------------------------------
// dataforseo_serp — top 10 organic results for a keyword
// ---------------------------------------------------------------------------

export const dataforSeoSerpDefinition: Anthropic.Messages.Tool = {
  name: "dataforseo_serp",
  description:
    "Get the top 10 organic search results for a keyword. Returns title, URL, and snippet for each result. Use for SERP landscape research: identify competitor titles, content angles, and gaps before generating title proposals.",
  input_schema: {
    type: "object" as const,
    properties: {
      keyword: {
        type: "string",
        description: "The keyword or phrase to search",
      },
      location_code: {
        type: "number",
        description: "DataForSEO location code (default: 2840 = United States)",
      },
    },
    required: ["keyword"],
  },
};

type SerpResult = {
  rank: number;
  title: string;
  url: string;
  snippet: string;
};

type SerpInput = {
  keyword: string;
  location_code?: number;
};

export async function executeDataforSeoSerp(
  input: SerpInput
): Promise<{ results: SerpResult[] }> {
  const { keyword, location_code = 2840 } = input;
  const auth = getAuth();

  const res = await fetch(
    "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword,
          location_code,
          language_code: "en",
          depth: 10,
          se_domain: "google.com",
        },
      ]),
    }
  );

  if (!res.ok) {
    throw new Error(`DataForSEO SERP error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const items: Record<string, unknown>[] =
    data?.tasks?.[0]?.result?.[0]?.items ?? [];

  const results: SerpResult[] = items
    .filter((item) => item.type === "organic")
    .slice(0, 10)
    .map((item, i) => ({
      rank: i + 1,
      title: (item.title as string) ?? "",
      url: (item.url as string) ?? "",
      snippet: (item.description as string) ?? "",
    }));

  return { results };
}

// ---------------------------------------------------------------------------
// dataforseo_keyword_info — volume + difficulty for one keyword
// ---------------------------------------------------------------------------

export const dataforSeoKeywordInfoDefinition: Anthropic.Messages.Tool = {
  name: "dataforseo_keyword_info",
  description:
    "Get monthly search volume, keyword difficulty, and search intent for a keyword. Use when you need to verify or compare keyword metrics.",
  input_schema: {
    type: "object" as const,
    properties: {
      keyword: {
        type: "string",
        description: "The keyword to look up",
      },
      location_code: {
        type: "number",
        description: "DataForSEO location code (default: 2840 = United States)",
      },
    },
    required: ["keyword"],
  },
};

type KeywordInfoResult = {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
};

type KeywordInfoInput = {
  keyword: string;
  location_code?: number;
};

// ---------------------------------------------------------------------------
// dataforseo_related_keywords — expand a seed keyword into related candidates
// ---------------------------------------------------------------------------

export const dataforSeoRelatedKeywordsDefinition: Anthropic.Messages.Tool = {
  name: "dataforseo_related_keywords",
  description:
    "Expand a seed keyword into up to 100 related keywords, each with search volume, " +
    "keyword difficulty, and search intent. Use during keyword_research to " +
    "discover candidate subkeywords before clustering into groups.",
  input_schema: {
    type: "object" as const,
    properties: {
      keyword: {
        type: "string",
        description: "The seed keyword to expand",
      },
      location_code: {
        type: "number",
        description: "DataForSEO location code (default: 2840 = United States)",
      },
      limit: {
        type: "number",
        description: "Max related keywords to return (default: 50, max: 100)",
      },
    },
    required: ["keyword"],
  },
};

type RelatedKeywordsInput = {
  keyword: string;
  location_code?: number;
  limit?: number;
};

type RelatedKeyword = {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: string;
  competition_level: string;
};

type RelatedKeywordsResult = {
  seed: string;
  results: RelatedKeyword[];
};

export async function executeDataforSeoRelatedKeywords(
  input: RelatedKeywordsInput
): Promise<RelatedKeywordsResult> {
  const { keyword, location_code = 2840, limit = 50 } = input;
  const auth = getAuth();

  const res = await fetch(
    "https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword,
          location_code,
          language_code: "en",
          limit: Math.min(limit, 100),
        },
      ]),
    }
  );

  if (!res.ok) {
    throw new Error(`DataForSEO related keywords error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const items: Record<string, unknown>[] =
    data?.tasks?.[0]?.result?.[0]?.items ?? [];

  const results: RelatedKeyword[] = items.map((item) => {
    const kd = item.keyword_data as Record<string, unknown> | undefined;
    const ki = kd?.keyword_info as Record<string, unknown> | undefined;
    const kp = kd?.keyword_properties as Record<string, unknown> | undefined;
    const si = kd?.search_intent_info as Record<string, unknown> | undefined;

    return {
      keyword: (kd?.keyword as string) ?? (item.keyword as string) ?? "",
      volume: (ki?.search_volume as number) ?? 0,
      difficulty: (kp?.keyword_difficulty as number) ?? 0,
      intent: (si?.main_intent as string) ?? "",
      competition_level: (ki?.competition_level as string) ?? "",
    };
  });

  return { seed: keyword, results };
}

export async function executeDataforSeoKeywordInfo(
  input: KeywordInfoInput
): Promise<KeywordInfoResult> {
  const { keyword, location_code = 2840 } = input;
  const auth = getAuth();

  // Volume
  const volRes = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google/search_volume/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { keywords: [keyword], location_code, language_code: "en" },
      ]),
    }
  );

  if (!volRes.ok) {
    throw new Error(
      `DataForSEO volume error ${volRes.status}: ${await volRes.text()}`
    );
  }

  const volData = await volRes.json();
  const volResult = volData?.tasks?.[0]?.result?.[0];
  const volume =
    typeof volResult?.search_volume === "number" ? volResult.search_volume : 0;

  // Difficulty + intent
  const kdRes = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google/keywords/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { keywords: [keyword], location_code, language_code: "en" },
      ]),
    }
  );

  let difficulty = 0;
  let intent = "";

  if (kdRes.ok) {
    const kdData = await kdRes.json();
    const kdItems = kdData?.tasks?.[0]?.result?.[0]?.items;
    if (kdItems?.length > 0) {
      const item = kdItems[0];
      difficulty = Math.max(
        0,
        Math.min(
          100,
          (item.keyword_info?.keyword_difficulty as number) ?? 0
        )
      );
      intent =
        (item.keyword_info?.search_intent_info?.main_intent as string) ?? "";
    }
  }

  return { keyword, volume, difficulty, intent };
}
