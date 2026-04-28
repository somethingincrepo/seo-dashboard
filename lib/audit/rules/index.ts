import type { Page, PageRule, PageViolation, Rule, SiteContext, SiteRule, SiteViolation, Violation } from "./types";

import { R001_pageNonOkStatus } from "./R001-page-non-ok-status";
import { R002_redirectChainTooLong } from "./R002-redirect-chain-too-long";
import { R003_mixedContent } from "./R003-mixed-content";
import { R004_canonicalMissing } from "./R004-canonical-missing";
import { R005_canonicalTargetBroken } from "./R005-canonical-target-broken";
import { R006_canonicalCrossDomain } from "./R006-canonical-cross-domain";
import { R007_noindexInSitemap } from "./R007-noindex-in-sitemap";
import { R008_noindexOnNavPage } from "./R008-noindex-on-nav-page";
import { R009_robotsTxtMissing } from "./R009-robots-txt-missing";
import { R010_sitemapMissing } from "./R010-sitemap-missing";
import { R011_sitemapContainsBrokenUrls } from "./R011-sitemap-contains-broken-urls";
import { R012_sitemapContainsNoindex } from "./R012-sitemap-contains-noindex";
import { R013_httpsNotEnforced } from "./R013-https-not-enforced";
import { R014_hstsMissing } from "./R014-hsts-missing";
import { R015_responseTimeSlow } from "./R015-response-time-slow";
import { R016_responseTimeCritical } from "./R016-response-time-critical";
import { R017_renderedHtmlOversized } from "./R017-rendered-html-oversized";
import { R018_multipleH1 } from "./R018-multiple-h1";
import { R019_skippedHeadingLevel } from "./R019-skipped-heading-level";
import { R020_hreflangInvalid } from "./R020-hreflang-invalid";
import { R021_urlUppercase } from "./R021-url-uppercase";
import { R022_urlWhitespace } from "./R022-url-whitespace";

import { R023_titleMissing } from "./R023-title-missing";
import { R024_titleTooLong } from "./R024-title-too-long";
import { R025_titleTooShort } from "./R025-title-too-short";
import { R026_titleDuplicate } from "./R026-title-duplicate";
import { R027_titleGeneric } from "./R027-title-generic";
import { R028_metaDescriptionMissing } from "./R028-meta-description-missing";
import { R029_metaDescriptionTooLong } from "./R029-meta-description-too-long";
import { R030_metaDescriptionTooShort } from "./R030-meta-description-too-short";
import { R031_metaDescriptionDuplicate } from "./R031-meta-description-duplicate";
import { R032_metaDescriptionMatchesTitle } from "./R032-meta-description-matches-title";
import { R033_h1Missing } from "./R033-h1-missing";
import { R034_h1Generic } from "./R034-h1-generic";
import { R035_ogTitleMissing } from "./R035-og-title-missing";
import { R036_ogImageMissing } from "./R036-og-image-missing";
import { R037_ogImageBroken } from "./R037-og-image-broken";
import { R038_twitterCardMissing } from "./R038-twitter-card-missing";
import { R039_jsonldInvalid } from "./R039-jsonld-invalid";
import { R040_organizationSchemaMissingOnHome } from "./R040-organization-schema-missing-on-home";
import { R041_altTextMissing } from "./R041-alt-text-missing";
import { R042_altTextTooLong } from "./R042-alt-text-too-long";
import { R043_altTextFilename } from "./R043-alt-text-filename";
import { R044_allCapsHeading } from "./R044-all-caps-heading";

import { R045_wordCountThin } from "./R045-word-count-thin";
import { R046_wordCountExtremelyThin } from "./R046-word-count-extremely-thin";
import { R047_zeroOutboundInternalLinks } from "./R047-zero-outbound-internal-links";
import { R048_orphanPage } from "./R048-orphan-page";
import { R049_singleInboundLink } from "./R049-single-inbound-link";
import { R050_clickDepthExcessive } from "./R050-click-depth-excessive";
import { R051_brokenInternalLinks } from "./R051-broken-internal-links";
import { R052_brokenExternalLinks } from "./R052-broken-external-links";
import { R053_genericAnchorExcessive } from "./R053-generic-anchor-excessive";
import { R054_unsafeBlankTarget } from "./R054-unsafe-blank-target";
import { R055_duplicateContent } from "./R055-duplicate-content";
import { R056_textToHtmlLow } from "./R056-text-to-html-low";
import { R057_placeholderText } from "./R057-placeholder-text";
import { R058_unsubstitutedTemplateVars } from "./R058-unsubstituted-template-vars";
import { R059_tableWithoutHeader } from "./R059-table-without-header";
import { R060_singleItemList } from "./R060-single-item-list";
import { R061_articleNoImages } from "./R061-article-no-images";
import { R062_internalLinksOutExcessive } from "./R062-internal-links-out-excessive";

import { R063_llmsTxtMissing } from "./R063-llms-txt-missing";
import { R064_llmsFullTxtMissing } from "./R064-llms-full-txt-missing";
import { R065_websiteSearchActionMissing } from "./R065-website-search-action-missing";
import { R066_sameAsThin } from "./R066-sameas-thin";
import { R067_faqSchemaNotUsed } from "./R067-faq-schema-not-used";
import { R068_howToSchemaNotUsed } from "./R068-howto-schema-not-used";
import { R069_authorSchemaMissingOnArticle } from "./R069-author-schema-missing-on-article";
import { R070_articleSchemaMissing } from "./R070-article-schema-missing";
import { R071_productSchemaMissing } from "./R071-product-schema-missing";
import { R072_localBusinessSchemaMissing } from "./R072-localbusiness-schema-missing";
import { R073_articleStale } from "./R073-article-stale";
import { R074_articleNoToc } from "./R074-article-no-toc";
import { R075_aggregateRatingMissing } from "./R075-aggregate-rating-missing";

export const PAGE_RULES: PageRule[] = [
  R001_pageNonOkStatus,
  R002_redirectChainTooLong,
  R003_mixedContent,
  R004_canonicalMissing,
  R005_canonicalTargetBroken,
  R006_canonicalCrossDomain,
  R007_noindexInSitemap,
  R008_noindexOnNavPage,
  R015_responseTimeSlow,
  R016_responseTimeCritical,
  R017_renderedHtmlOversized,
  R018_multipleH1,
  R019_skippedHeadingLevel,
  R020_hreflangInvalid,
  R021_urlUppercase,
  R022_urlWhitespace,

  R023_titleMissing,
  R024_titleTooLong,
  R025_titleTooShort,
  R026_titleDuplicate,
  R027_titleGeneric,
  R028_metaDescriptionMissing,
  R029_metaDescriptionTooLong,
  R030_metaDescriptionTooShort,
  R031_metaDescriptionDuplicate,
  R032_metaDescriptionMatchesTitle,
  R033_h1Missing,
  R034_h1Generic,
  R035_ogTitleMissing,
  R036_ogImageMissing,
  R037_ogImageBroken,
  R038_twitterCardMissing,
  R039_jsonldInvalid,
  R040_organizationSchemaMissingOnHome,
  R041_altTextMissing,
  R042_altTextTooLong,
  R043_altTextFilename,
  R044_allCapsHeading,

  R045_wordCountThin,
  R046_wordCountExtremelyThin,
  R047_zeroOutboundInternalLinks,
  R048_orphanPage,
  R049_singleInboundLink,
  R050_clickDepthExcessive,
  R051_brokenInternalLinks,
  R052_brokenExternalLinks,
  R053_genericAnchorExcessive,
  R054_unsafeBlankTarget,
  R055_duplicateContent,
  R056_textToHtmlLow,
  R057_placeholderText,
  R058_unsubstitutedTemplateVars,
  R059_tableWithoutHeader,
  R060_singleItemList,
  R061_articleNoImages,
  R062_internalLinksOutExcessive,

  R065_websiteSearchActionMissing,
  R066_sameAsThin,
  R067_faqSchemaNotUsed,
  R068_howToSchemaNotUsed,
  R069_authorSchemaMissingOnArticle,
  R070_articleSchemaMissing,
  R071_productSchemaMissing,
  R072_localBusinessSchemaMissing,
  R073_articleStale,
  R074_articleNoToc,
  R075_aggregateRatingMissing,
];

export const SITE_RULES: SiteRule[] = [
  R009_robotsTxtMissing,
  R010_sitemapMissing,
  R011_sitemapContainsBrokenUrls,
  R012_sitemapContainsNoindex,
  R013_httpsNotEnforced,
  R014_hstsMissing,
  R063_llmsTxtMissing,
  R064_llmsFullTxtMissing,
];

export const ALL_RULES: Rule[] = [...PAGE_RULES, ...SITE_RULES];

export function runPageRules(
  page: Page,
  ctx: { allPages: Page[]; site: SiteContext },
): PageViolation[] {
  const out: PageViolation[] = [];
  for (const r of PAGE_RULES) {
    const v = r.check(page, ctx);
    if (v) out.push(v);
  }
  return out;
}

export function runSiteRules(ctx: { allPages: Page[]; site: SiteContext }): SiteViolation[] {
  const out: SiteViolation[] = [];
  for (const r of SITE_RULES) {
    const v = r.check(ctx);
    if (v) out.push(v);
  }
  return out;
}

export function runAllRules(args: { pages: Page[]; site: SiteContext }): {
  page_violations: Map<string, PageViolation[]>;
  site_violations: SiteViolation[];
} {
  const ctx = { allPages: args.pages, site: args.site };
  const map = new Map<string, PageViolation[]>();
  for (const p of args.pages) map.set(p.id, runPageRules(p, ctx));
  return { page_violations: map, site_violations: runSiteRules(ctx) };
}

export type { Page, SiteContext, Violation, Rule };
export { type PageRule, type SiteRule } from "./types";
