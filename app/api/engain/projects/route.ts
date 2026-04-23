import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEngainIdentity } from "@/lib/engain";

export async function GET() {
  const authed = await getSession();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const identity = await getEngainIdentity();
    return NextResponse.json({ projects: identity.projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not set") || message.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
