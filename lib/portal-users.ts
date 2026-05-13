import { getSupabase } from "./supabase";

export type PortalUser = {
  id: string;
  client_id: string;
  portal_token: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export async function getPortalUserByUsername(username: string): Promise<PortalUser | null> {
  const { data } = await getSupabase()
    .from("portal_users")
    .select("*")
    .eq("username", username.toLowerCase().trim())
    .maybeSingle();
  return (data as PortalUser) ?? null;
}

export async function getPortalUserByClientId(clientId: string): Promise<PortalUser | null> {
  const { data } = await getSupabase()
    .from("portal_users")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as PortalUser) ?? null;
}

export async function upsertPortalUser(
  clientId: string,
  portalToken: string,
  username: string,
  passwordHash: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from("portal_users")
    .upsert(
      {
        client_id: clientId,
        portal_token: portalToken,
        username: username.toLowerCase().trim(),
        password_hash: passwordHash,
        updated_at: now,
      },
      { onConflict: "client_id" }
    );
  if (error) console.warn("[portal_users] upsert error:", error.message);
}

export async function listPortalUsers(): Promise<PortalUser[]> {
  const { data } = await getSupabase()
    .from("portal_users")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as PortalUser[];
}
