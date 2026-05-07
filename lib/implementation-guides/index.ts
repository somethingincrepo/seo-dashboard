import type { Client } from "@/lib/clients";
import type { Capabilities, Platform } from "@/lib/connections/types";
import { platformFromCmsField, isManualOnly } from "@/lib/connections/registry";
import { genericGuides } from "./generic";
import type { DeliverableType, GuideEntry, ResolveResult } from "./types";

// Capability each deliverable maps to. "none" = always manual in v1.
const DELIVERABLE_CAPABILITY: Record<DeliverableType, keyof Capabilities | "none"> = {
  title_tag: "metadata",
  meta_description: "metadata",
  h1: "h1",
  content_rewrite: "contentUpdate",
  content_block_insert: "contentUpdate",
  full_article_publish: "contentUpdate",
  alt_text: "altText",
  redirect: "redirect",
  faq_schema: "faqInjection",
  schema_org: "schemaInjection",
  location_signals: "schemaInjection",
  canonical: "none",
  internal_link_insertion: "none",
  robots_txt: "none",
  sitemap_xml: "none",
  indexation_submit: "none",
};

// Platform-specific guide registries. Each file exports a partial map.
// Import them here as they are authored (Steps 4 and 6).
type PlatformRegistry = Partial<Record<DeliverableType, GuideEntry>>;

// Keyed by `${platform}:${variant}` or `${platform}` for variant-free entries.
const PLATFORM_GUIDES: Partial<Record<string, PlatformRegistry>> = {
  // wordpress_self entries are added in Step 4:
  // "wordpress_self:yoast": wordpressYoastGuides,
  // "wordpress_self:rankmath": wordpressRankMathGuides,
  // "wordpress_self": wordpressDefaultGuides,
  // Shopify, Webflow, HubSpot, etc. added in Step 6.
};

function lookupEntry(
  deliverable: DeliverableType,
  platform: Platform,
  variant: string | undefined
): GuideEntry | null {
  if (variant) {
    const key = `${platform}:${variant}`;
    const entry = PLATFORM_GUIDES[key]?.[deliverable];
    if (entry) return entry;
  }
  const entry = PLATFORM_GUIDES[platform]?.[deliverable];
  if (entry) return entry;
  return null;
}

function seoPluginVariant(client: Client): string | undefined {
  const plugin = (client.fields.seo_plugin ?? "").toLowerCase().replace(/\s+/g, "");
  if (plugin.includes("yoast")) return "yoast";
  if (plugin.includes("rankmath")) return "rankmath";
  return undefined;
}

function isAutoEligible(
  deliverable: DeliverableType,
  platform: Platform | null,
  client: Client,
  capabilities: Capabilities | null
): boolean {
  if (platform !== "wordpress_self") return false;
  if (!client.fields.wp_username || !client.fields.wp_app_password) return false;
  const capKey = DELIVERABLE_CAPABILITY[deliverable];
  if (capKey === "none") return false;
  if (!capabilities) return false;
  return capabilities[capKey] === true;
}

export function resolveGuide(
  deliverable: DeliverableType,
  client: Client,
  capabilities?: Capabilities | null
): ResolveResult {
  const platform = platformFromCmsField(client.fields.cms);
  const caps = capabilities ?? null;

  const variant = platform === "wordpress_self" ? seoPluginVariant(client) : undefined;
  const specific = platform ? lookupEntry(deliverable, platform, variant) : null;
  const entry = specific ?? genericGuides[deliverable];

  if (platform && isManualOnly(platform)) {
    return { entry, mode: "manual", reason: `${platform} does not support automated writes` };
  }

  if (isAutoEligible(deliverable, platform, client, caps)) {
    return {
      entry,
      mode: "auto",
      reason: "WordPress with valid credentials and capability confirmed",
    };
  }

  if (!platform) {
    return { entry, mode: "manual", reason: "CMS not recognized — generic guide shown" };
  }

  if (platform !== "wordpress_self") {
    return { entry, mode: "manual", reason: `${platform} does not support automated writes` };
  }

  if (!client.fields.wp_username || !client.fields.wp_app_password) {
    return { entry, mode: "manual", reason: "WordPress credentials not configured" };
  }

  const capKey = DELIVERABLE_CAPABILITY[deliverable];
  if (capKey === "none") {
    return { entry, mode: "manual", reason: "This change type is always manual in v1" };
  }

  return { entry, mode: "manual", reason: "Capability not confirmed for this site" };
}

export type { DeliverableType, GuideEntry, ResolveResult } from "./types";
