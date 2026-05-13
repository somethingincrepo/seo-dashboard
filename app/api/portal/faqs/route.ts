import { NextRequest, NextResponse } from "next/server";
import { requirePortalAuth } from "@/lib/portal-auth";
import { approveFaqSection, skipFaqSection } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { id?: string; action?: string; token?: string };
  const { id, action, token = "" } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }
  if (action !== "approve" && action !== "skip") {
    return NextResponse.json({ error: 'action must be "approve" or "skip"' }, { status: 400 });
  }

  const authErr = await requirePortalAuth(token);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  if (action === "approve") {
    await approveFaqSection(id);
  } else {
    await skipFaqSection(id);
  }

  return NextResponse.json({ ok: true });
}
