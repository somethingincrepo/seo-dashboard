import { getSupabase } from "@/lib/supabase";
import { decrypt, encrypt } from "./crypto";
import { getAdapter } from "./registry";
import {
  Connection,
  ConnectionPublic,
  ConnectionStatus,
  DecryptedConnection,
  HealthCheckResult,
  Platform,
  ValidateResult,
} from "./types";

const TABLE = "connections";
const EVENTS = "connection_events";

function rowToPublic(row: Connection): ConnectionPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { access_token_encrypted, refresh_token_encrypted, ...rest } = row;
  return {
    ...rest,
    has_token: !!access_token_encrypted,
  };
}

function rowToDecrypted(row: Connection): DecryptedConnection {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { access_token_encrypted, refresh_token_encrypted, ...rest } = row;
  if (!access_token_encrypted) {
    throw new Error(`Connection ${row.id} has no encrypted token`);
  }
  return {
    ...rest,
    accessToken: decrypt(access_token_encrypted),
    refreshToken: refresh_token_encrypted ? decrypt(refresh_token_encrypted) : null,
  };
}

async function logEvent(
  connectionId: string,
  eventType: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    await getSupabase().from(EVENTS).insert({
      connection_id: connectionId,
      event_type: eventType,
      payload,
    });
  } catch (e) {
    console.warn("[connections] logEvent failed:", e);
  }
}

export async function listConnectionsForClient(clientId: string): Promise<ConnectionPublic[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listConnectionsForClient: ${error.message}`);
  return (data as Connection[] | null ?? []).map(rowToPublic);
}

export async function getConnectionPublic(id: string): Promise<ConnectionPublic | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("id", id).single();
  if (error || !data) return null;
  return rowToPublic(data as Connection);
}

export async function getConnectionDecrypted(id: string): Promise<DecryptedConnection | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("id", id).single();
  if (error || !data) return null;
  return rowToDecrypted(data as Connection);
}

export async function getConnectionByPlatform(
  clientId: string,
  platform: Platform
): Promise<ConnectionPublic | null> {
  const { data } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToPublic(data as Connection) : null;
}

type UpsertInput = {
  clientId: string;
  platform: Platform;
  validation: ValidateResult;
  status?: ConnectionStatus;
};

export async function upsertConnectionFromValidation(input: UpsertInput): Promise<ConnectionPublic> {
  const { clientId, platform, validation } = input;
  const status: ConnectionStatus = input.status ?? "active";

  const row = {
    client_id: clientId,
    platform,
    status,
    display_name: validation.displayName,
    external_site_id: validation.externalSiteId || null,
    capabilities: validation.capabilities,
    metadata: validation.metadata ?? {},
    access_token_encrypted: encrypt(validation.accessToken),
    refresh_token_encrypted: validation.refreshToken ? encrypt(validation.refreshToken) : null,
    expires_at: validation.expiresAt ?? null,
    last_verified_at: new Date().toISOString(),
  };

  // Upsert by (client_id, platform, external_site_id). null external_site_id is treated as ''
  // by the unique index using COALESCE — match that here.
  const externalKey = row.external_site_id ?? "";
  const { data: existing } = await getSupabase()
    .from(TABLE)
    .select("id")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .or(`external_site_id.eq.${externalKey},external_site_id.is.null`)
    .limit(1)
    .maybeSingle();

  let connectionId: string;
  if (existing?.id) {
    connectionId = (existing as { id: string }).id;
    const { error } = await getSupabase().from(TABLE).update(row).eq("id", connectionId);
    if (error) throw new Error(`upsertConnectionFromValidation update: ${error.message}`);
  } else {
    const { data, error } = await getSupabase().from(TABLE).insert(row).select("id").single();
    if (error || !data) throw new Error(`upsertConnectionFromValidation insert: ${error?.message}`);
    connectionId = (data as { id: string }).id;
  }

  await logEvent(connectionId, "connected", { platform, displayName: validation.displayName });
  const conn = await getConnectionPublic(connectionId);
  if (!conn) throw new Error("Connection not found after upsert");
  return conn;
}

export async function connectManual(
  clientId: string,
  platform: Platform,
  input: Record<string, string>
): Promise<ConnectionPublic> {
  const adapter = getAdapter(platform);
  if (!adapter.validateManualCredentials) {
    throw new Error(`Platform ${platform} does not support paste-credential connection`);
  }
  const validation = await adapter.validateManualCredentials(input);
  return upsertConnectionFromValidation({ clientId, platform, validation });
}

export async function disconnectConnection(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .update({ status: "revoked" as ConnectionStatus, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`disconnectConnection: ${error.message}`);
  await logEvent(id, "revoked", { source: "user" });
}

export async function verifyConnection(id: string): Promise<HealthCheckResult> {
  const conn = await getConnectionDecrypted(id);
  if (!conn) return { ok: false, reason: "unknown", error: "Connection not found" };
  const adapter = getAdapter(conn.platform);
  const result = await adapter.verifyConnection(conn);

  if (result.ok) {
    await getSupabase()
      .from(TABLE)
      .update({
        last_verified_at: new Date().toISOString(),
        status: "active" as ConnectionStatus,
        capabilities: result.capabilities,
      })
      .eq("id", id);
    await logEvent(id, "verified", { capabilities: result.capabilities });
  } else if (result.reason === "unauthorized") {
    await getSupabase()
      .from(TABLE)
      .update({ status: "expired" as ConnectionStatus })
      .eq("id", id);
    await logEvent(id, "health_check_failed", { reason: result.reason, error: result.error });
  } else {
    await logEvent(id, "health_check_failed", { reason: result.reason, error: result.error });
  }
  return result;
}

// ─── OAuth state CSRF helpers ─────────────────────────────────────────────────

export async function createOauthState(input: {
  clientId: string;
  platform: Platform;
  redirectAfter?: string;
}): Promise<string> {
  const state = cryptoRandomString(48);
  const { error } = await getSupabase().from("oauth_states").insert({
    state,
    client_id: input.clientId,
    platform: input.platform,
    redirect_after: input.redirectAfter ?? null,
  });
  if (error) throw new Error(`createOauthState: ${error.message}`);
  return state;
}

export async function consumeOauthState(state: string): Promise<{
  client_id: string;
  platform: Platform;
  redirect_after: string | null;
} | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  await sb.from("oauth_states").delete().eq("state", state);
  return data as { client_id: string; platform: Platform; redirect_after: string | null };
}

function cryptoRandomString(len: number): string {
  // URL-safe base64ish, 0-9 a-z A-Z
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("crypto");
  const buf: Buffer = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}
