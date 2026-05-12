import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listOpportunitiesForClient,
  updateOpportunityStatus,
} from "@/lib/reddit";

export async function GET(request: NextRequest) {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  try {
    const result = await listOpportunitiesForClient(clientId, {
      status: searchParams.get("status") ?? undefined,
      keyword: searchParams.get("keyword") ?? undefined,
      limit: Number(searchParams.get("limit") ?? 25),
      offset: Number(searchParams.get("offset") ?? 0),
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as { id?: string; clientId?: string; status?: string };
    const { id, clientId, status } = body;

    if (!id || !clientId || !status) {
      return NextResponse.json({ error: "id, clientId, and status are required" }, { status: 400 });
    }
    if (!["viewed", "replied", "dismissed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await updateOpportunityStatus(id, clientId, status as "viewed" | "replied" | "dismissed");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
