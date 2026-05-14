import type { Client } from "../clients";
import type { Capabilities, Platform } from "../connections/types";
import { platformFromCmsField } from "../connections/registry";
import type {
  CmsGuideTable,
  DeliverableType,
  GuideEntry,
  GuidePlatform,
  ResolveResult,
} from "./types";
import { GENERIC_GUIDES } from "./generic";
import { WORDPRESS_YOAST_GUIDES } from "./wordpress-yoast";
import { WORDPRESS_RANKMATH_GUIDES } from "./wordpress-rankmath";
import { SHOPIFY_GUIDES } from "./shopify";
import { WEBFLOW_GUIDES } from "./webflow";
import { HUBSPOT_GUIDES } from "./hubspot";
import { SQUARESPACE_GUIDES } from "./squarespace";
import { WIX_GUIDES } from "./wix";
import { FRAMER_GUIDES } from "./framer";

// Merges multiple CmsGuideTables into one where each deliverable is an array of variants.
// Used to combine Yoast and RankMath into a single wordpress_self table.
function mergeVariants(...tables: CmsGuideTable[]): CmsGuideTable {
  const keys = Object.keys(tables[0]) as DeliverableType[];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      tables.flatMap((t) => {
        const v = t[key];
        return Array.isArray(v) ? v : [v];
      }),
    ])
  ) as CmsGuideTable;
}

const WORDPRESS_GUIDES = mergeVariants(WORDPRESS_YOAST_GUIDES, WORDPRESS_RANKMATH_GUIDES);

const CMS_TABLES: Partial<Record<Platform, CmsGuideTable>> = {
  wordpress_self: WORDPRESS_GUIDES,
  shopify: SHOPIFY_GUIDES,
  webflow: WEBFLOW_GUIDES,
  hubspot: HUBSPOT_GUIDES,
  squarespace: SQUARESPACE_GUIDES,
  wix: WIX_GUIDES,
  framer: FRAMER_GUIDES,
};

// Maps a deliverable to the Capabilities key that gates auto-implementation.
// Deliverables with a `null` mapping are always manual in v1.
const CAPABILITY_FOR_DELIVERABLE: Record<DeliverableType, keyof Capabilities | null> = {
  title_tag: "metadata",
  meta_description: "metadata",
  h1: "h1",
  internal_link_insertion: null,
  content_rewrite: "contentUpdate",
  content_block_insert: "contentUpdate",
  full_article_publish: "contentUpdate",
  schema_org: "schemaInjection",
  faq_schema: "faqInjection",
  location_signals: "schemaInjection",
  redirect: "redirect",
  canonical: null,
  alt_text: "altText",
  robots_txt: null,
  sitemap_xml: null,
  indexation_submit: null,
};

function pickVariant(entryOrList: GuideEntry | GuideEntry[], variant?: string): GuideEntry {
  if (!Array.isArray(entryOrList)) return entryOrList;
  if (variant) {
    const match = entryOrList.find((e) => e.variant === variant);
    if (match) return match;
  }
  // Prefer "default" variant if present, otherwise first entry.
  return entryOrList.find((e) => e.variant === "default") ?? entryOrList[0];
}

function variantForClient(platform: Platform | null, client: Client): string | undefined {
  if (platform === "wordpress_self") {
    const plugin = (client.fields.seo_plugin || "").toLowerCase();
    if (plugin.includes("rank")) return "rankmath";
    if (plugin.includes("yoast")) return "yoast";
    return "yoast"; // safest default for WordPress
  }
  return undefined;
}

function hasCapability(client: Client, platform: Platform, deliverable: DeliverableType): boolean {
  const capKey = CAPABILITY_FOR_DELIVERABLE[deliverable];
  if (!capKey) return false;
  if (platform !== "wordpress_self") return false; // v1: only WP auto-implements
  // For WordPress we infer capability from credentials presence.
  // (The full Capabilities object is computed during a connection health check; for the portal
  // approval surface we conservatively treat creds-present as auto-eligible for the deliverables
  // listed in CAPABILITY_FOR_DELIVERABLE. The worker still verifies before running.)
  const hasCreds = Boolean(client.fields.wp_username && client.fields.wp_app_password);
  return hasCreds;
}

export function resolveGuide(deliverable: DeliverableType, client: Client): ResolveResult {
  const platform = platformFromCmsField(client.fields.cms);
  const variant = platform ? variantForClient(platform, client) : undefined;

  // Lookup priority: cms-specific (with variant) → cms-specific (no variant) → generic
  let entry: GuideEntry | undefined;
  if (platform && CMS_TABLES[platform]) {
    const table = CMS_TABLES[platform]!;
    const found = table[deliverable];
    if (found) entry = pickVariant(found, variant);
  }
  if (!entry) {
    const fallback = GENERIC_GUIDES[deliverable];
    entry = pickVariant(fallback);
  }

  const isAuto = platform ? hasCapability(client, platform, deliverable) : false;
  const selfImplement = client.fields.cms; // unused; mode is computed without per-change override here

  return {
    entry,
    mode: isAuto ? "auto" : "manual",
    reason: isAuto
      ? `${platform} auto-eligible (capability + credentials present)`
      : platform
        ? `${platform} ${variant ?? ""} manual${CAPABILITY_FOR_DELIVERABLE[deliverable] === null ? " (deliverable always manual in v1)" : ""}`.trim()
        : "no CMS configured, generic fallback",
    platform: (platform as GuidePlatform) ?? "generic",
  };
}

// Convenience: applies the per-change opt-out flag.
export function resolveGuideForChange(
  deliverable: DeliverableType,
  client: Client,
  changeFields: { client_self_implement?: boolean }
): ResolveResult {
  const base = resolveGuide(deliverable, client);
  if (changeFields.client_self_implement) {
    return { ...base, mode: "manual", reason: "client opted in to self-implement" };
  }
  return base;
}

// Rules where current_value is a measurement (ratio, count, %) rather than
// actual page text. Using current_value as "Find this text" is meaningless for
// these — the fix is always adding/inserting content, not replacing a phrase.
const CONTENT_INSERT_RULES = new Set(["R045", "R046", "R056"]);

/**
 * Maps an audit issue (by rule_id + rule_name) to a DeliverableType.
 * Prefer this over deliverableFromChangeType for audit-portal rendering
 * because it uses the stable rule_id rather than the freeform rule_name string.
 */
export function deliverableForIssue(
  ruleId: string | undefined,
  ruleName: string | undefined,
): DeliverableType | null {
  // Measurement rules: current_value is a metric, not page text. Must add
  // content rather than find+replace.
  if (ruleId && CONTENT_INSERT_RULES.has(ruleId)) return "content_block_insert";
  // Fall back to name-based matching for all other rules.
  return deliverableFromChangeType(ruleName);
}

// Maps an Airtable Change.fields.type string to our internal DeliverableType.
// Types in the Changes table are agent-written and somewhat freeform, so we normalize generously.
export function deliverableFromChangeType(type: string | undefined): DeliverableType | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes("title")) return "title_tag";
  if (t.includes("meta") && t.includes("desc")) return "meta_description";
  if (t === "h1" || t.includes("heading")) return "h1";
  if (t.includes("internal link") || t.includes("internal-link")) return "internal_link_insertion";
  if (t.includes("rewrite") || (t.includes("content") && !t.includes("block"))) return "content_rewrite";
  if (t.includes("block") || t.includes("insert")) return "content_block_insert";
  if (t.includes("publish") || t.includes("article")) return "full_article_publish";
  if (t.includes("faq")) return "faq_schema";
  if (t.includes("local") || t.includes("location") || t.includes("geo")) return "location_signals";
  if (t.includes("schema") || t.includes("structured")) return "schema_org";
  if (t.includes("redirect")) return "redirect";
  if (t.includes("canonical")) return "canonical";
  if (t.includes("alt")) return "alt_text";
  if (t.includes("robots")) return "robots_txt";
  if (t.includes("sitemap")) return "sitemap_xml";
  if (t.includes("indexation") || t.includes("indexing")) return "indexation_submit";
  return null;
}

export type { DeliverableType, GuideEntry, GuideStep, ResolveResult } from "./types";
