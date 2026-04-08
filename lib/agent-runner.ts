import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { getSupabase, type SupabaseJob } from "./supabase";
import { getToolDefinitions, executeTool } from "./tool-registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SopMeta = {
  name?: string;
  tools?: string[];
  max_iterations?: number;
  timeout_ms?: number;
  model?: string;
};

type Sop = {
  meta: SopMeta;
  body: string;
};

export type RunResult = {
  success: boolean;
  result: Record<string, unknown> | null;
  error: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string;
};

// ---------------------------------------------------------------------------
// Cost table  (USD per million tokens)
// ---------------------------------------------------------------------------

const COST_PER_M: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
};

function calcCost(model: string, inputT: number, outputT: number): number {
  const rates = COST_PER_M[model] ?? { input: 3.0, output: 15.0 };
  return (inputT * rates.input + outputT * rates.output) / 1_000_000;
}

// ---------------------------------------------------------------------------
// SOP loading
// ---------------------------------------------------------------------------

function parseFrontmatter(content: string): Sop {
  const match = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const yamlStr = match[1];
  const body = match[2].trim();
  const meta: Record<string, unknown> = {};
  const lines = yamlStr.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) { i++; continue; }

    const key = kv[1];
    const val = kv[2].trim();

    if (val === "") {
      // Inline list follows
      const items: string[] = [];
      i++;
      while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s+-\s+/, "").trim());
        i++;
      }
      meta[key] = items;
    } else if (val === "true") {
      meta[key] = true; i++;
    } else if (val === "false") {
      meta[key] = false; i++;
    } else if (val !== "" && !isNaN(Number(val))) {
      meta[key] = Number(val); i++;
    } else {
      meta[key] = val; i++;
    }
  }

  return { meta: meta as SopMeta, body };
}

export function loadSop(sopName: string): Sop {
  const filePath = join(process.cwd(), "sops", `${sopName}.md`);
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`SOP not found: ${sopName}`);
  }
  return parseFrontmatter(content);
}

// ---------------------------------------------------------------------------
// Log helper  (fire-and-forget; agent never stalls on a log failure)
// ---------------------------------------------------------------------------

async function log(
  jobId: string,
  message: string,
  level: "info" | "warn" | "error" = "info"
): Promise<void> {
  try {
    await getSupabase().from("job_logs").insert({ job_id: jobId, message, level });
  } catch {
    console.error(`[agent-runner] log failed (${level}): ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Retry wrapper for Anthropic API calls
// ---------------------------------------------------------------------------

async function callWithRetry(
  fn: () => Promise<Anthropic.Messages.Message>,
  maxRetries = 3
): Promise<Anthropic.Messages.Message> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isApiError = err instanceof APIError;
      const status = isApiError ? (err.status ?? 0) : 0;

      // Fatal errors — fail immediately, no retry
      if (status === 400 || status === 401 || status === 403) throw err;

      // No more retries
      if (attempt === maxRetries) throw err;

      // Only retry on transient server errors
      if (![500, 502, 503, 529].includes(status)) throw err;

      const delayMs = Math.min(1_000 * 2 ** attempt, 16_000);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Unreachable");
}

// ---------------------------------------------------------------------------
// Atomic claim
// ---------------------------------------------------------------------------

export async function claimJob(jobId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("jobs")
    .update({ status: "claimed", started_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("id")
    .single();
  return !error && !!data;
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

export async function runJob(job: SupabaseJob): Promise<RunResult> {
  const supabase = getSupabase();
  const jobId = job.id;

  // --- Load SOP ---
  let sop: Sop;
  try {
    sop = loadSop(job.sop_name);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("jobs")
      .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
      .eq("id", jobId);
    return { success: false, result: null, error: msg, input_tokens: 0, output_tokens: 0, cost_usd: 0, model: "" };
  }

  const model = sop.meta.model ?? "claude-haiku-4-5-20251001";
  const maxIterations = sop.meta.max_iterations ?? 20;
  const timeoutMs = sop.meta.timeout_ms ?? 270_000;
  const toolNames = sop.meta.tools ?? [];

  await log(jobId, `SOP: ${job.sop_name} | model: ${model} | max_iter: ${maxIterations} | tools: [${toolNames.join(", ")}]`);

  // Mark running
  await supabase.from("jobs").update({ status: "running" }).eq("id", jobId);

  // --- Validate tools ---
  let toolDefs: Anthropic.Messages.Tool[];
  try {
    toolDefs = getToolDefinitions(toolNames);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("jobs")
      .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
      .eq("id", jobId);
    return { success: false, result: null, error: msg, input_tokens: 0, output_tokens: 0, cost_usd: 0, model };
  }

  // --- Build Anthropic client ---
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // --- Initial message ---
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `Job ID: ${jobId}\nClient ID: ${job.client_id ?? "none"}\nPayload:\n${JSON.stringify(job.payload, null, 2)}`,
    },
  ];

  let totalIn = 0;
  let totalOut = 0;
  let iterations = 0;
  let finalResult: Record<string, unknown> | null = null;
  const deadline = Date.now() + timeoutMs;

  try {
    // --- Tool loop ---
    while (true) {
      if (Date.now() > deadline) {
        throw new Error(`Job timed out after ${timeoutMs}ms`);
      }
      if (iterations >= maxIterations) {
        throw new Error(`Max iterations reached (${maxIterations})`);
      }

      await log(jobId, `Iter ${iterations + 1}/${maxIterations}: calling ${model}`);

      const response = await callWithRetry(() =>
        client.messages.create({
          model,
          max_tokens: 4096,
          system: sop.body,
          tools: toolDefs.length > 0 ? toolDefs : undefined,
          messages,
        })
      );

      totalIn += response.usage.input_tokens;
      totalOut += response.usage.output_tokens;

      messages.push({ role: "assistant", content: response.content });

      await log(
        jobId,
        `stop: ${response.stop_reason} | +${response.usage.input_tokens}in +${response.usage.output_tokens}out`
      );

      // --- Done ---
      if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
        const textBlock = response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
        if (textBlock) {
          try {
            finalResult = JSON.parse(textBlock.text);
          } catch {
            finalResult = { text: textBlock.text };
          }
        }
        break;
      }

      if (response.stop_reason === "max_tokens") {
        throw new Error("Model hit max_tokens limit");
      }

      if (response.stop_reason !== "tool_use") {
        throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
      }

      // --- Execute tool calls ---
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const tu of toolUseBlocks) {
        await log(jobId, `tool: ${tu.name}(${JSON.stringify(tu.input).slice(0, 300)})`);

        let resultContent: string;
        try {
          const result = await executeTool(tu.name, tu.input as Record<string, unknown>);
          resultContent = JSON.stringify(result);
          await log(jobId, `tool_result: ${resultContent.slice(0, 300)}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          resultContent = JSON.stringify({ error: msg });
          await log(jobId, `tool_error: ${msg}`, "error");
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: resultContent,
        });
      }

      messages.push({ role: "user", content: toolResults });
      iterations++;
    }

    const cost = calcCost(model, totalIn, totalOut);
    await log(jobId, `Done | in: ${totalIn} out: ${totalOut} cost: $${cost.toFixed(6)}`);

    await supabase
      .from("jobs")
      .update({
        status: "done",
        result: finalResult,
        input_tokens: totalIn,
        output_tokens: totalOut,
        cost_usd: cost,
        model,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { success: true, result: finalResult, error: null, input_tokens: totalIn, output_tokens: totalOut, cost_usd: cost, model };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const cost = calcCost(model, totalIn, totalOut);

    await log(jobId, `Failed: ${msg}`, "error");

    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error: msg,
        input_tokens: totalIn,
        output_tokens: totalOut,
        cost_usd: cost,
        model,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { success: false, result: null, error: msg, input_tokens: totalIn, output_tokens: totalOut, cost_usd: cost, model };
  }
}
