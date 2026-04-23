"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSession, destroySession } from "@/lib/auth";

const ADMIN_MAX_ATTEMPTS = 10;
const ADMIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ADMIN_RL_COOKIE = "admin_rl";

async function checkAdminRateLimit(): Promise<boolean> {
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

export async function login(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const next = formData.get("next") as string | null;

  const base = next
    ? `/login?error=1&next=${encodeURIComponent(next)}`
    : "/login?error=1";

  const allowed = await checkAdminRateLimit();
  if (!allowed) redirect(base);

  const ok = await createSession(username, password);
  if (!ok) redirect(base);

  // Clear rate limit on successful login
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_RL_COOKIE);

  // Only allow redirects to internal paths (never to external URLs)
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }

  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
