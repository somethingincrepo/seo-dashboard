import {
  Capabilities,
  DecryptedConnection,
  EMPTY_CAPABILITIES,
  HealthCheckResult,
  ValidateResult,
} from "../types";

function basicAuth(username: string, appPassword: string): string {
  return "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
}

function normalizeSiteUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function probeCapabilities(siteUrl: string, auth: string): Promise<Capabilities> {
  const caps: Capabilities = { ...EMPTY_CAPABILITIES };

  // Yoast or RankMath — drives metadata capability via REST
  try {
    const r = await fetchWithTimeout(`${siteUrl}/wp-json/`, { headers: { Authorization: auth } }, 6000);
    if (r.ok) {
      const idx = (await r.json()) as { namespaces?: string[] };
      const ns = idx.namespaces ?? [];
      if (ns.some((n) => n === "yoast/v1" || n === "rankmath/v1" || n === "wp/v2")) {
        caps.metadata = true;
        caps.h1 = true;
        caps.contentUpdate = true;
        caps.altText = true;
        caps.noindex = true;
      }
    }
  } catch {
    // Probe failure isn't fatal — leave caps off.
  }

  // Code Snippets plugin — drives FAQ + schema injection
  try {
    const r = await fetchWithTimeout(
      `${siteUrl}/wp-json/code-snippets/v2/snippets?per_page=1`,
      { headers: { Authorization: auth } },
      6000
    );
    if (r.ok || r.status === 401 /* exists but creds insufficient */) {
      caps.faqInjection = true;
      caps.schemaInjection = true;
    }
  } catch {
    // ignore
  }

  return caps;
}

export const wordpressSelf = {
  platform: "wordpress_self" as const,

  async validateManualCredentials(input: Record<string, string>): Promise<ValidateResult> {
    const siteUrl = normalizeSiteUrl(String(input.site_url || "").trim());
    const username = String(input.username || "").trim();
    const appPassword = String(input.application_password || "").trim();

    if (!siteUrl) throw new Error("site_url is required");
    if (!username) throw new Error("username is required");
    if (!appPassword) throw new Error("application_password is required");
    if (!/^https?:\/\//.test(siteUrl)) throw new Error("site_url must start with http:// or https://");

    const auth = basicAuth(username, appPassword);

    const r = await fetchWithTimeout(
      `${siteUrl}/wp-json/wp/v2/users/me`,
      { headers: { Authorization: auth } },
      10000
    );

    if (r.status === 401 || r.status === 403) {
      throw new Error(
        "Auth failed — check your username and application password. Make sure it's an Application Password, not your login password."
      );
    }
    if (!r.ok) {
      throw new Error(`WordPress REST API returned ${r.status}. Confirm REST API is enabled.`);
    }

    const user = (await r.json()) as { id?: number; name?: string; slug?: string; roles?: string[] };
    const capabilities = await probeCapabilities(siteUrl, auth);

    // Redirect capability comes from a separate Cloudflare connection — leave off here.
    return {
      accessToken: appPassword, // store the app password as the token
      externalSiteId: siteUrl,
      displayName: user.name || user.slug || siteUrl,
      metadata: {
        site_url: siteUrl,
        username,
        seo_plugin: input.seo_plugin || "",
        page_builder: input.page_builder || "",
        wp_user_id: user.id ?? null,
        roles: user.roles ?? [],
      },
      capabilities,
    };
  },

  async verifyConnection(connection: DecryptedConnection): Promise<HealthCheckResult> {
    const siteUrl = String(connection.metadata.site_url || connection.external_site_id || "");
    const username = String(connection.metadata.username || "");
    if (!siteUrl || !username) {
      return { ok: false, reason: "unknown", error: "Missing site_url or username on connection" };
    }
    const auth = basicAuth(username, connection.accessToken);
    try {
      const r = await fetchWithTimeout(
        `${siteUrl}/wp-json/wp/v2/users/me`,
        { headers: { Authorization: auth } },
        8000
      );
      if (r.status === 401 || r.status === 403) {
        return { ok: false, reason: "unauthorized", error: "Application password rejected" };
      }
      if (!r.ok) return { ok: false, reason: "unknown", error: `HTTP ${r.status}` };
      const capabilities = await probeCapabilities(siteUrl, auth);
      return { ok: true, capabilities };
    } catch (e) {
      return { ok: false, reason: "network", error: e instanceof Error ? e.message : String(e) };
    }
  },
};
