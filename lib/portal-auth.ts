import { cookies } from "next/headers";
import { promisify } from "util";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { isAdminAuthenticated } from "./auth";

const scryptAsync = promisify(scrypt);

const COOKIE_NAME = "portal_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ---------- Password hashing (scrypt) ----------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(hash, "hex");
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

// ---------- Session payload ----------

export type PortalSession = {
  client_id: string;    // Airtable record ID
  portal_token: string; // UUID token — used to build the /portal/[token] URL
};

function getSecret(): string {
  const s = process.env.PORTAL_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("PORTAL_SESSION_SECRET is not set");
  return s;
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${payload}.${sigHex}`;
}

async function hmacVerify(token: string): Promise<string | null> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const expected = await hmacSign(payload);
  if (expected !== token) return null;
  return payload;
}

// ---------- Cookie helpers ----------

export async function createPortalSession(
  session: PortalSession
): Promise<void> {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signed = await hmacSign(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function destroyPortalSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const payload = await hmacVerify(cookie.value);
  if (!payload) return null;
  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as PortalSession;
  } catch {
    return null;
  }
}

// Returns null when auth is valid, or {status, error} when it should be rejected.
// Admin sessions bypass the portal session requirement so admins can view any portal.
export async function requirePortalAuth(
  token: string
): Promise<{ status: 401 | 403; error: string } | null> {
  if (await isAdminAuthenticated()) return null;
  const session = await getPortalSession();
  if (!session) return { status: 401, error: "Unauthorized" };
  if (session.portal_token !== token) return { status: 403, error: "Forbidden" };
  return null;
}
