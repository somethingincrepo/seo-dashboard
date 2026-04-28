import { getSupabase } from "@/lib/supabase";

export interface TriggerAuditArgs {
  client_id: string;            // Airtable record id (matches existing client_id column conventions)
  client_name: string;
  root_url: string;
  triggered_by: "intake" | "admin_rerun" | "scheduled";
  nav_urls?: string[];
}

export interface TriggerAuditResult {
  audit_run_id: string;
}

/**
 * Inserts an audit_runs row, then fires the Fly crawler webhook.
 * The crawler responds 202 quickly and runs the pipeline in the background;
 * it will POST back to /api/audit/diagnose when crawling completes.
 *
 * Errors are surfaced to the caller; the intake route wraps this in try/catch
 * to keep audit failures from blocking client creation.
 */
export async function triggerAudit(args: TriggerAuditArgs): Promise<TriggerAuditResult> {
  const supabase = getSupabase();

  const { data: run, error: insertErr } = await supabase
    .from("audit_runs")
    .insert({
      client_id: args.client_id,
      client_name: args.client_name,
      root_url: args.root_url,
      status: "queued",
      triggered_by: args.triggered_by,
    })
    .select("id")
    .single();

  if (insertErr || !run) {
    throw new Error(`audit_runs insert failed: ${insertErr?.message ?? "no row returned"}`);
  }

  const auditRunId = (run as { id: string }).id;

  const crawlerUrl = process.env.CRAWLER_SERVICE_URL;
  const crawlerToken = process.env.CRAWLER_SERVICE_TOKEN;
  if (!crawlerUrl || !crawlerToken) {
    throw new Error("CRAWLER_SERVICE_URL and CRAWLER_SERVICE_TOKEN must be set");
  }

  const resp = await fetch(`${crawlerUrl.replace(/\/$/, "")}/crawl`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${crawlerToken}`,
    },
    body: JSON.stringify({
      audit_run_id: auditRunId,
      client_id: args.client_id,
      root_url: args.root_url,
      nav_urls: args.nav_urls ?? [args.root_url],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok && resp.status !== 202) {
    const text = await resp.text().catch(() => "");
    // Mark the run as failed so it doesn't sit in 'queued' forever.
    await supabase.from("audit_runs").update({
      status: "failed",
      error_message: `Crawler webhook ${resp.status}: ${text.slice(0, 500)}`,
    }).eq("id", auditRunId);
    throw new Error(`Crawler webhook returned ${resp.status}`);
  }

  return { audit_run_id: auditRunId };
}
