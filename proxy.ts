import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

// Protected routes that require admin auth
const PROTECTED = ["/", "/clients", "/jobs", "/approvals", "/users", "/token-usage", "/design-review", "/activity", "/reverts"];

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  const dotIdx = payload.indexOf(".");
  if (dotIdx === -1) return false;
  const exp = parseInt(payload.slice(dotIdx + 1), 10);

  if (isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const computed = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const computedSig = toBase64Url(computed);

  return computedSig === sig;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow portal, login, api, and static assets through
  if (
    pathname.startsWith("/portal") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  // Check if path needs protection
  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!needsAuth) return NextResponse.next();

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const valid = await verifySessionToken(sessionCookie, secret);
  if (!valid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
