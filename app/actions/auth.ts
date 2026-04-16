"use server";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";

export async function login(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const next = formData.get("next") as string | null;

  const ok = await createSession(username, password);
  if (!ok) {
    const base = next
      ? `/login?error=1&next=${encodeURIComponent(next)}`
      : "/login?error=1";
    redirect(base);
  }

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
