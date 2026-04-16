"use server";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";

export async function login(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const ok = await createSession(username, password);
  if (!ok) {
    redirect("/login?error=1");
  }
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
