import { cookies } from "next/headers";
import { promisify } from "util";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { isAdminAuthenticated } from "./auth";
import { getSupabase } from "./supabase";

const scryptAsync = promisify(scrypt);

const COOKIE_NAME = "portal_session";
// Session lasts 7 days. Extended on every request while within renewal threshold.
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_S = SESSION_MAX_AGE_MS / 1000;
const RENEWAL_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // extend if < 2 days remain

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
  client_id: string;
  portal_token: string;
  username: string;
  session_id: string;
};

// ---------- Database session helpers ----------

async function getSessionById(sessionId: string): Promise<{
  client_id: string;
  portal_token: string;
  username: string;
  expires_at: string;
} | null> {
  const { data } = await getSupabase()
    .from("portal_sessions")
    .select("client_id, portal_token, username, expires_at")
    .eq("id", sessionId)
    .maybeSingle();
  return data ?? null;
}

// ---------- Cookie helpers ----------

export async function createPortalSession(
  session: { client_id: string; portal_token: string; username: string },
  meta?: { userAgent?: string; ip?: string }
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);

  const { data, error } = await getSupabase()
    .from("portal_sessions")
    .insert({
      client_id: session.client_id,
      portal_token: session.portal_token,
      username: session.username,
      expires_at: expiresAt.toISOString(),
      last_seen_at: now.toISOString(),
      user_agent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[portal_sessions] insert error:", error?.message);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, data.id as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
  });
}

export async function destroyPortalSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (sessionId) {
    try {
      await getSupabase().from("portal_sessions").delete().eq("id", sessionId);
    } catch { /* non-fatal */ }
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const row = await getSessionById(sessionId);
  if (!row) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  const now = Date.now();
  if (now >= expiresAt) {
    // Expired — clean it up
    try {
      await getSupabase().from("portal_sessions").delete().eq("id", sessionId);
    } catch { /* non-fatal */ }
    return null;
  }

  // Rolling renewal: extend the session if it's within the renewal window
  if (expiresAt - now < RENEWAL_THRESHOLD_MS) {
    const newExpiry = new Date(now + SESSION_MAX_AGE_MS).toISOString();
    try {
      await getSupabase()
        .from("portal_sessions")
        .update({ expires_at: newExpiry, last_seen_at: new Date(now).toISOString() })
        .eq("id", sessionId);
      // Refresh the browser cookie to match
      cookieStore.set(COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: SESSION_MAX_AGE_S,
        path: "/",
      });
    } catch { /* non-fatal */ }
  } else {
    // Still update last_seen_at for the admin activity view
    try {
      await getSupabase()
        .from("portal_sessions")
        .update({ last_seen_at: new Date(now).toISOString() })
        .eq("id", sessionId);
    } catch { /* non-fatal */ }
  }

  return {
    client_id: row.client_id,
    portal_token: row.portal_token,
    username: row.username,
    session_id: sessionId,
  };
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

// ---------- Active session queries (for admin view) ----------

export type ActivePortalSession = {
  id: string;
  client_id: string;
  portal_token: string;
  username: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  user_agent: string | null;
  ip: string | null;
};

export async function listActiveSessions(): Promise<ActivePortalSession[]> {
  const { data } = await getSupabase()
    .from("portal_sessions")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("last_seen_at", { ascending: false })
    .limit(200);
  return (data ?? []) as ActivePortalSession[];
}

export async function revokeSession(sessionId: string): Promise<void> {
  await getSupabase().from("portal_sessions").delete().eq("id", sessionId);
}

export async function revokeAllSessionsForClient(clientId: string): Promise<void> {
  await getSupabase().from("portal_sessions").delete().eq("client_id", clientId);
}

// ---------- Login event queries (for admin view) ----------

export type LoginEvent = {
  id: number;
  username: string;
  success: boolean;
  user_type: string;
  client_id: string | null;
  ip: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  created_at: string;
};

export async function listLoginEvents(limit = 100): Promise<LoginEvent[]> {
  const { data } = await getSupabase()
    .from("login_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as LoginEvent[];
}
