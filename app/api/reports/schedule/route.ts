import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { airtableFetch } from "@/lib/airtable";
import type { ClientFields } from "@/lib/clients";
import type { AirtableRecord } from "@/lib/clients";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow overriding the target day (for testing). Default: today's day-of-month.
  let targetDay: number | null = null;
  try {
    const body = await request.json().catch(() => ({})) as { day?: number };
    if (body.day && typeof body.day === "number") {
      targetDay = body.day;
    }
  } catch {
    // no body is fine
  }

  const today = new Date();
  const dayOfMonth = targetDay ?? today.getDate();

  // Fetch all active clients with a report_day set
  const clients = await airtableFetch<AirtableRecord<ClientFields>>("Clients", {
    filterByFormula: `AND({status}="active", {report_day}>0)`,
    maxRecords: 200,
  });

  const due = clients.filter((c) => c.fields.report_day === dayOfMonth);

  if (due.length === 0) {
    return NextResponse.json({ scheduled: 0, day: dayOfMonth, message: "No clients due today" });
  }

  const supabase = getSupabase();
  const scheduled: { client_id: string; company_name: string; job_id: string }[] = [];
  const errors: { client_id: string; error: string }[] = [];

  for (const client of due) {
    const clientId = client.id;
    const monthNumber = client.fields.month_number ?? 1;

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        sop_name: "report_generate",
        client_id: clientId,
        payload: {
          client_id: clientId,
          month: monthNumber,
        },
        status: "pending",
        runner: "fly",
        parent_job_id: null,
      })
      .select("id")
      .single();

    if (error) {
      errors.push({ client_id: clientId, error: error.message });
    } else {
      scheduled.push({
        client_id: clientId,
        company_name: client.fields.company_name,
        job_id: (data as { id: string }).id,
      });
    }
  }

  return NextResponse.json({
    scheduled: scheduled.length,
    day: dayOfMonth,
    clients: scheduled,
    errors: errors.length > 0 ? errors : undefined,
  });
}
