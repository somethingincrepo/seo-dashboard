import { NextRequest, NextResponse } from "next/server";
import { requirePortalAuth } from "@/lib/portal-auth";
import {
  getPageCreationSuggestionById,
  skipPageCreationSuggestion,
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

  await skipPageCreationSuggestion(id);

  return NextResponse.json({ ok: true });
}
