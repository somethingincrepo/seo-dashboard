"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getClientByUsername } from "@/lib/clients";
import {
  verifyPassword,
  createPortalSession,
  destroyPortalSession,
} from "@/lib/portal-auth";
import { createSession as createAdminSession } from "@/lib/auth";

const MAX_ATTEMPTS = 5;
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
    sameSite: "lax",
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
    redirect(token ? `/portal/login?error=rate_limited&token=${encodeURIComponent(token)}` : "/portal/login?error=rate_limited");
  }

  // --- Try admin credentials first ---
  const isAdmin = await createAdminSession(username, password);
  if (isAdmin) {
    const cookieStore = await cookies();
    cookieStore.delete(RATE_LIMIT_COOKIE);
    // If we know which portal they were heading to, go there; otherwise admin dashboard
    if (token) redirect(`/portal/${token}`);
    redirect("/");
  }

  // --- Try client credentials ---
  const client = await getClientByUsername(username);
  if (!client) redirect(errorUrl);

  const hash = client.fields.portal_password_hash;
  if (!hash) redirect(errorUrl);

  const valid = await verifyPassword(password, hash);
  if (!valid) redirect(errorUrl);

  // Clear rate limit on success
  const cookieStore = await cookies();
  cookieStore.delete(RATE_LIMIT_COOKIE);

  await createPortalSession({
    client_id: client.id,
    portal_token: client.fields.portal_token,
  });

  redirect(`/portal/${client.fields.portal_token}`);
}

export async function portalLogout() {
  await destroyPortalSession();
  redirect("/portal/login");
}
