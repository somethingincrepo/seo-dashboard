import { NextRequest, NextResponse } from "next/server";
import { getClientByToken } from "@/lib/clients";
import {
  getScheduledArticlesForClient,
  getOccupiedPublishDates,
} from "@/lib/content-schedule";
import { contentAirtablePatch } from "@/lib/airtable";

export const dynamic = "force-dynamic";

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

// GET /api/portal/content-schedule?token=xxx
// Returns the client's scheduled articles + all globally occupied dates (for calendar rendering)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const companyName = client.fields.company_name;
  if (!companyName) return NextResponse.json({ articles: [], occupied_dates: [] });

  try {
    const [articles, occupied] = await Promise.all([
      getScheduledArticlesForClient(companyName),
      getOccupiedPublishDates(),
    ]);

    return NextResponse.json({ articles, occupied_dates: Array.from(occupied) });
  } catch (err) {
    console.error("[GET /api/portal/content-schedule] error:", err);
    return NextResponse.json({ articles: [], occupied_dates: [] });
  }
}

// PATCH /api/portal/content-schedule?token=xxx
// Body: { result_id: string, new_date: string (YYYY-MM-DD) }
// Reschedule an article to a different publish date
export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as { result_id?: string; new_date?: string };
  const { result_id, new_date } = body;

  if (!result_id || !new_date) {
    return NextResponse.json({ error: "result_id and new_date required" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(new_date)) {
    return NextResponse.json({ error: "new_date must be YYYY-MM-DD" }, { status: 400 });
  }

  const d = new Date(new_date + "T12:00:00Z");
  if (!isWeekday(d)) {
    return NextResponse.json({ error: "Cannot schedule on a weekend" }, { status: 400 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (d < tomorrow) {
    return NextResponse.json({ error: "Cannot schedule in the past" }, { status: 400 });
  }

  // Check if this date is already taken by another article
  const occupied = await getOccupiedPublishDates();
  if (occupied.has(new_date)) {
    return NextResponse.json(
      { error: "That date already has an article scheduled", date_conflict: true },
      { status: 409 }
    );
  }

  try {
    await contentAirtablePatch("Results", result_id, { scheduled_publish_date: new_date });
    return NextResponse.json({ ok: true, scheduled_date: new_date });
  } catch (err) {
    console.error("[PATCH /api/portal/content-schedule] error:", err);
    return NextResponse.json({ error: "Failed to reschedule" }, { status: 500 });
  }
}

// PUT /api/portal/content-schedule?token=xxx
// Body: { result_id: string }
// Remove a scheduled date (unschedule — sets scheduled_publish_date to null)
export async function PUT(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json() as { result_id?: string; new_date?: string };
  const { result_id, new_date } = body;
  if (!result_id || !new_date) {
    return NextResponse.json({ error: "result_id and new_date required" }, { status: 400 });
  }

  // Re-use PATCH logic but the caller is explicitly requesting a specific date reassignment
  // (PUT here handles the case where the calendar UI assigns the FIRST date after approval)
  const d = new Date(new_date + "T12:00:00Z");
  if (!isWeekday(d)) {
    return NextResponse.json({ error: "Cannot schedule on a weekend" }, { status: 400 });
  }

  try {
    await contentAirtablePatch("Results", result_id, {
      scheduled_publish_date: new_date,
    });
    return NextResponse.json({ ok: true, scheduled_date: new_date });
  } catch (err) {
    console.error("[PUT /api/portal/content-schedule] error:", err);
    return NextResponse.json({ error: "Failed to schedule" }, { status: 500 });
  }
}

