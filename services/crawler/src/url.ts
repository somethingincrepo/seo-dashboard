const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid", "_ga", "ref", "yclid"]);

export function normalizeUrl(input: string): string {
  let u: URL;
  try { u = new URL(input); } catch { return input; }

  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) {
    u.port = "";
  }
  u.hash = "";

  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  const sorted: [string, string][] = [];
  u.searchParams.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (TRACKING_PARAMS.has(lower)) return;
    if (TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))) return;
    sorted.push([key, value]);
  });
  sorted.sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of sorted) u.searchParams.append(k, v);

  return u.toString();
}

export function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");
  } catch { return false; }
}

export function rootOrigin(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}
