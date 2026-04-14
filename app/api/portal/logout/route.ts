import { NextRequest, NextResponse } from "next/server";
import { destroyPortalSession } from "@/lib/portal-auth";

export async function POST(req: NextRequest) {
  await destroyPortalSession();
  return NextResponse.redirect(new URL("/portal/login", req.url));
}
