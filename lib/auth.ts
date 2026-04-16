import { cookies } from "next/headers";
import { getSupabase } from "./supabase";

const SESSION_COOKIE = "seo_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminRole = "admin" | "viewer";

export type AdminUser = {
  id: string;
  username: string;
  role: AdminRole;
  assigned_client_ids: string[];
  created_at: string;
};

export type AdminSession = {
  username: string;
  role: AdminRole;
  assigned_client_ids: string[];
};

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

async function setSessionCookie(username: string, secret: string): Promise<void> {
  const token = await makeToken(username, secret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

// ── Session CRUD ──────────────────────────────────────────────────────────────

export async function createSession(username: string, password: string): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;

  const supabase = getSupabase();

  // Bootstrap: table missing or empty → accept "admin" + ADMIN_PASSWORD
  const { count, error: countError } = await supabase
    .from("admin_users")
    .select("*", { count: "exact", head: true });

  const tableEmptyOrMissing = countError !== null || (count ?? 0) === 0;

  if (tableEmptyOrMissing) {
    if (username === "admin" && password === secret) {
      if (!countError) {
        const salt = randomHex();
        const hash = await hashPassword(salt, password);
        const { error: insertErr } = await supabase.from("admin_users").insert({
          username: "admin",
          password_hash: hash,
          password_salt: salt,
          role: "admin",
          assigned_client_ids: [],
        });
        // Fallback if role columns haven't been added yet
        if (insertErr) {
          await supabase.from("admin_users").insert({
            username: "admin",
            password_hash: hash,
            password_salt: salt,
          });
        }
      }
      await setSessionCookie("admin", secret);
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

  await setSessionCookie(username, secret);
  return true;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie?.value) return null;
  const username = await verifyToken(cookie.value, secret);
  if (!username) return null;

  // Use select('*') so missing columns (before migration) don't cause errors
  const { data } = await getSupabase()
    .from("admin_users")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  const role: AdminRole = (data?.role as AdminRole) ?? "admin";
  const assigned_client_ids: string[] = (data?.assigned_client_ids as string[]) ?? [];

  return { username, role, assigned_client_ids };
}

// ── Admin user management ─────────────────────────────────────────────────────

export async function createAdminUser(
  username: string,
  password: string,
  role: AdminRole = "viewer"
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

  // Try with role columns first; fall back to base columns if migration hasn't run
  let { error } = await supabase.from("admin_users").insert({
    username: username.trim(),
    password_hash: hash,
    password_salt: salt,
    role,
    assigned_client_ids: [],
  });

  if (error?.message?.includes("column") || error?.message?.includes("assigned_client_ids") || error?.message?.includes('"role"')) {
    const fallback = await supabase.from("admin_users").insert({
      username: username.trim(),
      password_hash: hash,
      password_salt: salt,
    });
    error = fallback.error;
  }

  if (error) return { error: error.message };
  return {};
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  // select('*') so missing columns (before migration) don't cause errors
  const { data } = await getSupabase()
    .from("admin_users")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []).map((u) => ({
    id: u.id,
    username: u.username,
    role: (u.role ?? "admin") as AdminRole,
    assigned_client_ids: (u.assigned_client_ids ?? []) as string[],
    created_at: u.created_at,
  }));
}

export async function updateAdminUser(
  id: string,
  updates: { role?: AdminRole; assigned_client_ids?: string[] }
): Promise<{ error?: string }> {
  const { error } = await getSupabase()
    .from("admin_users")
    .update(updates)
    .eq("id", id);
  if (error) {
    if (error.message?.includes("column") || error.message?.includes("assigned_client_ids") || error.message?.includes('"role"')) {
      return { error: "Role/client columns not yet added to the database. Run the migration in scripts/admin-users-roles-migration.sql via the Supabase SQL editor." };
    }
    return { error: error.message };
  }
  return {};
}

export async function deleteAdminUser(id: string): Promise<void> {
  await getSupabase().from("admin_users").delete().eq("id", id);
}

export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<{ error?: string }> {
  if (newPassword.length < 8) return { error: "New password must be at least 8 characters" };

  const supabase = getSupabase();
  const { data: user } = await supabase
    .from("admin_users")
    .select("id, password_hash, password_salt")
    .eq("username", username)
    .single();

  if (!user) return { error: "User not found" };

  const currentHash = await hashPassword(user.password_salt as string, currentPassword);
  if (currentHash !== user.password_hash) return { error: "Current password is incorrect" };

  const newSalt = randomHex();
  const newHash = await hashPassword(newSalt, newPassword);

  const { error } = await supabase
    .from("admin_users")
    .update({ password_hash: newHash, password_salt: newSalt })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function resetPassword(
  userId: string,
  newPassword: string
): Promise<{ error?: string }> {
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters" };

  const newSalt = randomHex();
  const newHash = await hashPassword(newSalt, newPassword);

  const { error } = await getSupabase()
    .from("admin_users")
    .update({ password_hash: newHash, password_salt: newSalt })
    .eq("id", userId);

  if (error) return { error: error.message };
  return {};
}
