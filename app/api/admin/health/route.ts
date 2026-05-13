import { NextRequest, NextResponse } from "next/server";
import { getSession, verifyBearer } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminPass && verifyBearer(request, adminPass)) return true;
  const session = await getSession();
  return !!session && session.role === "admin";
}

interface ServiceCheck {
  status: "ok" | "error" | "unconfigured";
  message: string;
  latency_ms?: number;
}

async function checkCrawler(): Promise<ServiceCheck> {
  const url = process.env.CRAWLER_SERVICE_URL;
  if (!url) return { status: "unconfigured", message: "CRAWLER_SERVICE_URL is not set" };
  const start = Date.now();
  try {
    const resp = await fetch(`${url.replace(/\/$/, "")}/health`, {
      method: "HEAD",
      signal: AbortSignal.timeout(6_000),
    });
    const latency_ms = Date.now() - start;
    if (resp.ok) return { status: "ok", message: `HTTP ${resp.status}`, latency_ms };
    return { status: "error", message: `HTTP ${resp.status}`, latency_ms };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e), latency_ms: Date.now() - start };
  }
}

async function checkSupabase(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("audit_runs").select("id").limit(1);
    const latency_ms = Date.now() - start;
    if (error) return { status: "error", message: error.message, latency_ms };
    return { status: "ok", message: "reachable", latency_ms };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e), latency_ms: Date.now() - start };
  }
}

async function checkAirtable(): Promise<ServiceCheck> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return { status: "unconfigured", message: "AIRTABLE_API_KEY or AIRTABLE_BASE_ID is not set" };
  const start = Date.now();
  try {
    const resp = await fetch(
      `https://api.airtable.com/v0/${baseId}/Clients?maxRecords=1&fields[]=company_name`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    const latency_ms = Date.now() - start;
    if (resp.ok) return { status: "ok", message: `HTTP ${resp.status}`, latency_ms };
    return { status: "error", message: `HTTP ${resp.status}`, latency_ms };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e), latency_ms: Date.now() - start };
  }
}

async function checkFlyWorker(): Promise<ServiceCheck> {
  const token = process.env.FLY_API_TOKEN;
  const appName = process.env.FLY_WORKER_APP_NAME ?? "seo-worker-winter-tree-4075";
  if (!token) return { status: "unconfigured", message: "FLY_API_TOKEN is not set — add it to enable worker health checks" };
  const start = Date.now();
  try {
    const resp = await fetch(`https://api.machines.dev/v1/apps/${appName}/machines`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    const latency_ms = Date.now() - start;
    if (!resp.ok) return { status: "error", message: `Fly API HTTP ${resp.status}`, latency_ms };
    const data = (await resp.json()) as Array<{ state?: string }>;
    const running = data.filter((m) => m.state === "started").length;
    if (running === 0) return { status: "error", message: `0 of ${data.length} machines running`, latency_ms };
    return { status: "ok", message: `${running} machine(s) running`, latency_ms };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e), latency_ms: Date.now() - start };
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [crawler, supabase, airtable, flyWorker] = await Promise.all([
    checkCrawler(),
    checkSupabase(),
    checkAirtable(),
    checkFlyWorker(),
  ]);

  const services = { crawler, supabase, airtable, fly_worker: flyWorker };
  const allOk = Object.values(services).every((s) => s.status === "ok" || s.status === "unconfigured");

  return NextResponse.json(
    { ok: allOk, services },
    { status: allOk ? 200 : 503 },
  );
}
