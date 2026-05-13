"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getClientByUsername } from "@/lib/clients";
import {
  verifyPassword,
  createPortalSession,
  destroyPortalSession,
} from "@/lib/portal-auth";
import { getPortalUserByUsername, upsertPortalUser } from "@/lib/portal-users";
import { createSession as createAdminSession, logLoginEvent } from "@/lib/auth";

const MAX_ATTEMPTS = 15;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_COOKIE = "portal_rl";

async function checkRateLimit(): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(RATE_LIMIT_COOKIE)?.value;
  const now = Date.now();

  let attempts = 0;
  let windowStart = now;

  if (raw) {
    try {
      const parsed = JSON.parse(Buffer.from(raw, "base64url").toString());
      if (now - parsed.start < WINDOW_MS) {
        attempts = parsed.count;
        windowStart = parsed.start;
      }
    } catch {
      // corrupt cookie — reset
    }
  }

  if (attempts >= MAX_ATTEMPTS) return false;

  const next = { count: attempts + 1, start: windowStart };
  cookieStore.set(RATE_LIMIT_COOKIE, Buffer.from(JSON.stringify(next)).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: WINDOW_MS / 1000,
    path: "/portal/login",
  });

  return true;
}

export async function portalLogin(formData: FormData) {
  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const token = formData.get("token") as string | null;

  const errorUrl = token
    ? `/portal/login?error=1&token=${encodeURIComponent(token)}`
    : "/portal/login?error=1";

  if (!username || !password) redirect(errorUrl);

  const allowed = await checkRateLimit();
  if (!allowed) {
    await logLoginEvent({ username, success: false, userType: "portal", failureReason: "rate_limited" });
    redirect(token ? `/portal/login?error=rate_limited&token=${encodeURIComponent(token)}` : "/portal/login?error=rate_limited");
  }

  // --- Try admin credentials first ---
  const isAdmin = await createAdminSession(username, password);
  if (isAdmin) {
    await logLoginEvent({ username, success: true, userType: "admin" });
    const cookieStore = await cookies();
    cookieStore.delete(RATE_LIMIT_COOKIE);
    if (token) redirect(`/portal/${token}`);
    redirect("/");
  }

  // --- Try client credentials: Supabase first, Airtable fallback ---

  // 1. Check Supabase portal_users (authoritative source)
  const portalUser = await getPortalUserByUsername(username);

  if (portalUser) {
    const valid = await verifyPassword(password, portalUser.password_hash);
    if (!valid) {
      await logLoginEvent({ username, success: false, userType: "portal", clientId: portalUser.client_id, failureReason: "wrong_password" });
      redirect(errorUrl);
    }
    const cookieStore = await cookies();
    cookieStore.delete(RATE_LIMIT_COOKIE);
    await logLoginEvent({ username, success: true, userType: "portal", clientId: portalUser.client_id });
    await createPortalSession({
      client_id: portalUser.client_id,
      portal_token: portalUser.portal_token,
      username,
    });
    redirect(`/portal/${portalUser.portal_token}`);
  }

  // 2. Airtable fallback (migration bridge — runs until all clients are in Supabase)
  const client = await getClientByUsername(username);
  if (!client) {
    await logLoginEvent({ username, success: false, userType: "portal", failureReason: "user_not_found" });
    redirect(errorUrl);
  }

  const hash = client.fields.portal_password_hash?.trim();
  if (!hash) {
    await logLoginEvent({ username, success: false, userType: "portal", clientId: client.id, failureReason: "no_hash" });
    redirect(errorUrl);
  }

  if (!client.fields.portal_token) redirect(errorUrl);

  const valid = await verifyPassword(password, hash);
  if (!valid) {
    await logLoginEvent({ username, success: false, userType: "portal", clientId: client.id, failureReason: "wrong_password" });
    redirect(errorUrl);
  }

  // Successful Airtable login — write to Supabase so next login uses the fast path
  await upsertPortalUser(client.id, client.fields.portal_token, username, hash);

  const cookieStore = await cookies();
  cookieStore.delete(RATE_LIMIT_COOKIE);
  await logLoginEvent({ username, success: true, userType: "portal", clientId: client.id });
  await createPortalSession({
    client_id: client.id,
    portal_token: client.fields.portal_token,
    username,
  });

  redirect(`/portal/${client.fields.portal_token}`);
}

export async function portalLogout() {
  await destroyPortalSession();
  redirect("/login");
}
