const ENGAIN_BASE = "https://api.engain.io";

function getHeaders() {
  const key = process.env.ENGAIN_API_KEY;
  if (!key) throw new Error("ENGAIN_API_KEY is not set");
  return {
    "X-API-Key": key,
    "Content-Type": "application/json",
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type EngainProject = {
  id: string;
  name: string;
};

export type EngainIdentity = {
  userId: string;
  projects: EngainProject[];
};

export type MentionItem = {
  id: string;
  projectId: string;
  brand: string;
  title: string;
  content: string;
  url: string;
  subreddit: string;
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  upvotes: number;
  comments: number;
  author: string;
  created_at: string;
  type: "post" | "comment";
};

export type MentionListResponse = {
  items: MentionItem[];
  total: number;
  page: number;
  limit: number;
};

export type MentionStats = {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  avg_score: number;
  top_subreddits: Array<{ subreddit: string; count: number }>;
};

export type MentionBrand = {
  id: string;
  name: string;
  projectId: string;
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function engainGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${ENGAIN_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Engain ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ─── Public functions ─────────────────────────────────────────────────────────

export async function getEngainIdentity(): Promise<EngainIdentity> {
  return engainGet<EngainIdentity>("/api/v1/me");
}

export async function getEngainMentions(
  projectId: string,
  params?: { limit?: number; page?: number; sentiment?: string; brand?: string }
): Promise<MentionListResponse> {
  return engainGet<MentionListResponse>("/api/v1/mentions", {
    projectId,
    ...(params?.limit ? { limit: String(params.limit) } : {}),
    ...(params?.page ? { page: String(params.page) } : {}),
    ...(params?.sentiment ? { sentiment: params.sentiment } : {}),
    ...(params?.brand ? { brand: params.brand } : {}),
  });
}

export async function getEngainMentionStats(projectId: string): Promise<MentionStats> {
  return engainGet<MentionStats>("/api/v1/mentions/stats", { projectId });
}

export async function getEngainBrands(projectId: string): Promise<MentionBrand[]> {
  const data = await engainGet<{ brands: MentionBrand[] }>("/api/v1/mentions/brands", { projectId });
  return data.brands ?? [];
}

export async function getEngainMention(mentionId: string): Promise<MentionItem> {
  return engainGet<MentionItem>(`/api/v1/mentions/${mentionId}`);
}
