import type Anthropic from "@anthropic-ai/sdk";

export const httpFetchDefinition: Anthropic.Messages.Tool = {
  name: "http_fetch",
  description:
    "Fetch a URL via HTTP. Returns the status code and response body (truncated to 8 KB).",
  input_schema: {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "The URL to fetch" },
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        description: "HTTP method (default: GET)",
      },
      headers: {
        type: "object",
        description: "Optional request headers",
        additionalProperties: { type: "string" },
      },
      body: {
        type: "string",
        description: "Request body string (for POST/PUT/PATCH)",
      },
      timeout_ms: {
        type: "number",
        description: "Request timeout in ms (default: 10000, max: 30000)",
      },
    },
    required: ["url"],
  },
};

type HttpFetchInput = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout_ms?: number;
};

type HttpFetchOutput = {
  status: number;
  body: string;
  headers: Record<string, string>;
};

export async function executeHttpFetch(input: HttpFetchInput): Promise<HttpFetchOutput> {
  const { url, method = "GET", headers = {}, body, timeout_ms = 10_000 } = input;
  const timeoutMs = Math.min(timeout_ms, 30_000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ?? undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    const truncated =
      text.length > 8192 ? text.slice(0, 8192) + "\n... [truncated]" : text;

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return { status: res.status, body: truncated, headers: responseHeaders };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`http_fetch failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}
