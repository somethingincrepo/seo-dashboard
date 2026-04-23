import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username = "admin", password } = body;
  if (!password) {
    return NextResponse.json(
      { error: "password is required" },
      { status: 400 }
    );
  }

  const ok = await createSession(username as string, password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // createSession() writes the seo_session cookie internally via next/headers cookies()
  return NextResponse.json({ ok: true });
}
