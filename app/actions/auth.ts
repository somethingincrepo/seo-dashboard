"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSession, destroySession, logLoginEvent } from "@/lib/auth";
import { getPortalUserByUsername } from "@/lib/portal-users";
import { getClientByUsername } from "@/lib/clients";
import { verifyPassword, createPortalSession } from "@/lib/portal-auth";
import { upsertPortalUser } from "@/lib/portal-users";

const ADMIN_MAX_ATTEMPTS = 20;
const ADMIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_RL_COOKIE = "admin_rl";

async function checkRateLimit(): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_RL_COOKIE)?.value;
  const now = Date.now();
  let attempts = 0;
  let windowStart = now;
  if (raw) {
    try {
      const parsed = JSON.parse(Buffer.from(raw, "base64url").toString());
      if (now - parsed.start < ADMIN_WINDOW_MS) {
        attempts = parsed.count;
        windowStart = parsed.start;
      }
    } catch { /* corrupt cookie — reset */ }
  }
  if (attempts >= ADMIN_MAX_ATTEMPTS) return false;
  const next = { count: attempts + 1, start: windowStart };
  cookieStore.set(ADMIN_RL_COOKIE, Buffer.from(JSON.stringify(next)).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_WINDOW_MS / 1000,
    path: "/login",
  });
  return true;
}

async function tryPortalCredentials(
  username: string,
  password: string
): Promise<{ client_id: string; portal_token: string } | null> {
  // Supabase first (authoritative)
  const portalUser = await getPortalUserByUsername(username);
  if (portalUser) {
    const valid = await verifyPassword(password, portalUser.password_hash);
    if (!valid) return null;
    await createPortalSession({ client_id: portalUser.client_id, portal_token: portalUser.portal_token, username });
    return { client_id: portalUser.client_id, portal_token: portalUser.portal_token };
  }

  // Airtable fallback (migration bridge)
  const client = await getClientByUsername(username);
  if (!client || !client.fields.portal_password_hash || !client.fields.portal_token) return null;
  const valid = await verifyPassword(password, client.fields.portal_password_hash);
  if (!valid) return null;
  // Write to Supabase so next login skips Airtable
  await upsertPortalUser(client.id, client.fields.portal_token, username, client.fields.portal_password_hash);
  await createPortalSession({ client_id: client.id, portal_token: client.fields.portal_token, username });
  return { client_id: client.id, portal_token: client.fields.portal_token };
}

export async function login(formData: FormData) {
  const username = ((formData.get("username") as string) || "").trim().toLowerCase();
  const password = formData.get("password") as string;
  const next = formData.get("next") as string | null;

  const errorBase = next ? `/login?error=1&next=${encodeURIComponent(next)}` : "/login?error=1";

  const allowed = await checkRateLimit();
  if (!allowed) {
    await logLoginEvent({ username, success: false, userType: "admin", failureReason: "rate_limited" });
    redirect("/login?error=rate_limited");
  }

  // --- Try admin credentials ---
  const adminOk = await createSession(username, password);
  if (adminOk) {
    await logLoginEvent({ username, success: true, userType: "admin" });
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_RL_COOKIE);
    if (next && next.startsWith("/") && !next.startsWith("//")) redirect(next);
    redirect("/");
  }

  // --- Try portal credentials ---
  const portal = await tryPortalCredentials(username, password);
  if (portal) {
    await logLoginEvent({ username, success: true, userType: "portal", clientId: portal.client_id });
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_RL_COOKIE);
    redirect(`/portal/${portal.portal_token}`);
  }

  await logLoginEvent({ username, success: false, userType: "portal", failureReason: "wrong_password" });
  redirect(errorBase);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
