import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type JobStatus = "pending" | "claimed" | "running" | "done" | "failed";
export type LogLevel = "info" | "warn" | "error" | "debug";

export type SupabaseJob = {
  id: string;
  sop_name: string;
  client_id: string | null;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string | null;
  parent_job_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type JobLog = {
  id: number;
  job_id: string;
  level: LogLevel;
  message: string;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;

let _client: Client | null = null;

export function getSupabase(): Client {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// Typed helpers so callers get proper types without fighting Supabase generics

export async function getJob(id: string): Promise<SupabaseJob | null> {
  const { data, error } = await getSupabase().from("jobs").select("*").eq("id", id).single();
  if (error) return null;
  return data as SupabaseJob;
}

export async function listJobs(limit = 100): Promise<SupabaseJob[]> {
  const { data } = await getSupabase()
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as SupabaseJob[];
}

export async function listLogs(jobId: string, after = 0): Promise<JobLog[]> {
  const { data } = await getSupabase()
    .from("job_logs")
    .select("*")
    .eq("job_id", jobId)
    .gt("id", after)
    .order("id", { ascending: true })
    .limit(200);
  return (data ?? []) as JobLog[];
}
