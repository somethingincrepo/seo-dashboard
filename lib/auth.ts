import { cookies } from "next/headers";
import { getSupabase } from "./supabase";

const SESSION_COOKIE = "seo_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ── Crypto helpers ────────────────────────────────────────────────────────────

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toBase64Url(sig);
}

export async function hashPassword(salt: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${password}`));
  return toHex(new Uint8Array(buf));
}

function randomHex(bytes = 16): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

// ── Session token (format: encUsername.exp.hmac) ──────────────────────────────

async function makeToken(username: string, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${encodeURIComponent(username)}.${exp}`;
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

/** Verifies an HMAC-signed session token. Returns username on success, null on failure. */
export async function verifyToken(token: string, secret: string): Promise<string | null> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  const dotIdx = payload.indexOf(".");
  if (dotIdx === -1) return null;
  const username = decodeURIComponent(payload.slice(0, dotIdx));
  const exp = parseInt(payload.slice(dotIdx + 1), 10);

  if (isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  const expected = await hmacSign(secret, payload);
  if (expected !== sig) return null;

  return username;
}

// ── Session CRUD ──────────────────────────────────────────────────────────────

export async function createSession(username: string, password: string): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;

  const supabase = getSupabase();

  // Bootstrap: if the table doesn't exist yet (error) or is empty (count === 0),
  // accept username "admin" + ADMIN_PASSWORD and auto-create the first account.
  const { count, error: countError } = await supabase
    .from("admin_users")
    .select("*", { count: "exact", head: true });

  const tableEmptyOrMissing = countError !== null || (count ?? 0) === 0;

  if (tableEmptyOrMissing) {
    if (username === "admin" && password === secret) {
      // If the table exists and is empty, persist the account for next time
      if (!countError) {
        const salt = randomHex();
        const hash = await hashPassword(salt, password);
        await supabase.from("admin_users").insert({
          username: "admin",
          password_hash: hash,
          password_salt: salt,
        });
      }
      const token = await makeToken("admin", secret);
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
        path: "/",
      });
      return true;
    }
    return false;
  }

  const { data: user } = await supabase
    .from("admin_users")
    .select("password_hash, password_salt")
    .eq("username", username)
    .single();

  if (!user) return false;

  const hash = await hashPassword(user.password_salt as string, password);
  if (hash !== user.password_hash) return false;

  const token = await makeToken(username, secret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return true;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<{ username: string } | null> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie?.value) return null;
  const username = await verifyToken(cookie.value, secret);
  if (!username) return null;
  return { username };
}

// ── Admin user management ─────────────────────────────────────────────────────

export async function createAdminUser(
  username: string,
  password: string
): Promise<{ error?: string }> {
  if (!username.trim() || !password) return { error: "Username and password are required" };

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("admin_users")
    .select("id")
    .eq("username", username.trim())
    .maybeSingle();

  if (existing) return { error: "Username already exists" };

  const salt = randomHex();
  const hash = await hashPassword(salt, password);

  const { error } = await supabase.from("admin_users").insert({
    username: username.trim(),
    password_hash: hash,
    password_salt: salt,
  });

  if (error) return { error: error.message };
  return {};
}

export async function listAdminUsers(): Promise<
  { id: string; username: string; created_at: string }[]
> {
  const { data } = await getSupabase()
    .from("admin_users")
    .select("id, username, created_at")
    .order("created_at", { ascending: true });
  return (data ?? []) as { id: string; username: string; created_at: string }[];
}

export async function deleteAdminUser(id: string): Promise<void> {
  await getSupabase().from("admin_users").delete().eq("id", id);
}
