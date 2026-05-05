import { isAdminAuthenticated } from "@/lib/auth";
import { getPortalSession } from "@/lib/portal-auth";
import { getClientByToken } from "@/lib/clients";

export type AuthContext = { kind: "admin" } | { kind: "portal"; clientId: string };

// Resolves the authenticated caller and the client they're allowed to operate on.
// - Admin: can pass any client_id explicitly.
// - Portal: their own client only.
export async function resolveAuth(requestedClientId?: string): Promise<
  | { ok: true; ctx: AuthContext; clientId: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  if (await isAdminAuthenticated()) {
    if (!requestedClientId) {
      return { ok: false, status: 400 as unknown as 403, error: "client_id required" };
    }
    return { ok: true, ctx: { kind: "admin" }, clientId: requestedClientId };
  }
  const session = await getPortalSession();
  if (!session) return { ok: false, status: 401, error: "Unauthorized" };

  // The session stores the Airtable record id. We need the user-facing client_id
  // (slug) — fetch it via portal_token.
  const client = await getClientByToken(session.portal_token);
  if (!client) return { ok: false, status: 401, error: "Client not found" };
  const clientId = client.fields.client_id;
  if (!clientId) return { ok: false, status: 401, error: "Client has no client_id slug" };

  if (requestedClientId && requestedClientId !== clientId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, ctx: { kind: "portal", clientId }, clientId };
}
