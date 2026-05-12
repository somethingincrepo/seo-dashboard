import { NextRequest, NextResponse } from "next/server";
import { requirePortalAuth } from "@/lib/portal-auth";
import {
  getSupabase,
  getPageCreationSuggestionById,
  approvePageCreationSuggestion,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as { token?: string };
  const token = body.token ?? "";

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  const suggestion = await getPageCreationSuggestionById(id);
  if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (suggestion.status !== "suggested") {
    return NextResponse.json({ error: `Cannot approve in status "${suggestion.status}"` }, { status: 409 });
  }

  await approvePageCreationSuggestion(id);

  // Queue page_creation_generator job on the Fly.io worker
  try {
    await getSupabase().from("jobs").insert({
      sop_name: "page_creation_generator",
      runner: "fly",
      client_id: suggestion.client_id,
      status: "pending",
      payload: { suggestion_id: id, client_id: suggestion.client_id },
    });
  } catch (err) {
    console.error("Failed to queue page_creation_generator job (non-fatal):", err);
  }

  return NextResponse.json({ ok: true });
}
