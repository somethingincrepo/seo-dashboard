import { describe, it, expect } from "vitest";
import { makePage, makeSite, ctxFor } from "./fixtures";

import { R001_pageNonOkStatus } from "../R001-page-non-ok-status";
import { R002_redirectChainTooLong } from "../R002-redirect-chain-too-long";
import { R003_mixedContent } from "../R003-mixed-content";
import { R004_canonicalMissing } from "../R004-canonical-missing";
import { R005_canonicalTargetBroken } from "../R005-canonical-target-broken";
import { R006_canonicalCrossDomain } from "../R006-canonical-cross-domain";
import { R007_noindexInSitemap } from "../R007-noindex-in-sitemap";
import { R008_noindexOnNavPage } from "../R008-noindex-on-nav-page";
import { R009_robotsTxtMissing } from "../R009-robots-txt-missing";
import { R010_sitemapMissing } from "../R010-sitemap-missing";
import { R011_sitemapContainsBrokenUrls } from "../R011-sitemap-contains-broken-urls";
import { R012_sitemapContainsNoindex } from "../R012-sitemap-contains-noindex";
import { R013_httpsNotEnforced } from "../R013-https-not-enforced";
import { R014_hstsMissing } from "../R014-hsts-missing";
import { R015_responseTimeSlow } from "../R015-response-time-slow";
import { R016_responseTimeCritical } from "../R016-response-time-critical";
import { R017_renderedHtmlOversized } from "../R017-rendered-html-oversized";
import { R018_multipleH1 } from "../R018-multiple-h1";
import { R019_skippedHeadingLevel } from "../R019-skipped-heading-level";
import { R020_hreflangInvalid } from "../R020-hreflang-invalid";
import { R021_urlUppercase } from "../R021-url-uppercase";
import { R022_urlWhitespace } from "../R022-url-whitespace";

import { R023_titleMissing } from "../R023-title-missing";
import { R024_titleTooLong } from "../R024-title-too-long";
import { R025_titleTooShort } from "../R025-title-too-short";
import { R026_titleDuplicate } from "../R026-title-duplicate";
import { R027_titleGeneric } from "../R027-title-generic";
import { R028_metaDescriptionMissing } from "../R028-meta-description-missing";
import { R029_metaDescriptionTooLong } from "../R029-meta-description-too-long";
import { R030_metaDescriptionTooShort } from "../R030-meta-description-too-short";
import { R031_metaDescriptionDuplicate } from "../R031-meta-description-duplicate";
import { R032_metaDescriptionMatchesTitle } from "../R032-meta-description-matches-title";
import { R033_h1Missing } from "../R033-h1-missing";
import { R034_h1Generic } from "../R034-h1-generic";
import { R035_ogTitleMissing } from "../R035-og-title-missing";
import { R036_ogImageMissing } from "../R036-og-image-missing";
import { R037_ogImageBroken } from "../R037-og-image-broken";
import { R038_twitterCardMissing } from "../R038-twitter-card-missing";
import { R039_jsonldInvalid } from "../R039-jsonld-invalid";
import { R040_organizationSchemaMissingOnHome } from "../R040-organization-schema-missing-on-home";
import { R041_altTextMissing } from "../R041-alt-text-missing";
import { R042_altTextTooLong } from "../R042-alt-text-too-long";
import { R043_altTextFilename } from "../R043-alt-text-filename";
import { R044_allCapsHeading } from "../R044-all-caps-heading";

import { R045_wordCountThin } from "../R045-word-count-thin";
import { R046_wordCountExtremelyThin } from "../R046-word-count-extremely-thin";
import { R047_zeroOutboundInternalLinks } from "../R047-zero-outbound-internal-links";
import { R048_orphanPage } from "../R048-orphan-page";
import { R049_singleInboundLink } from "../R049-single-inbound-link";
import { R050_clickDepthExcessive } from "../R050-click-depth-excessive";
import { R051_brokenInternalLinks } from "../R051-broken-internal-links";
import { R052_brokenExternalLinks } from "../R052-broken-external-links";
import { R053_genericAnchorExcessive } from "../R053-generic-anchor-excessive";
import { R054_unsafeBlankTarget } from "../R054-unsafe-blank-target";
import { R055_duplicateContent } from "../R055-duplicate-content";
import { R056_textToHtmlLow } from "../R056-text-to-html-low";
import { R057_placeholderText } from "../R057-placeholder-text";
import { R058_unsubstitutedTemplateVars } from "../R058-unsubstituted-template-vars";
import { R059_tableWithoutHeader } from "../R059-table-without-header";
import { R060_singleItemList } from "../R060-single-item-list";
import { R061_articleNoImages } from "../R061-article-no-images";
import { R062_internalLinksOutExcessive } from "../R062-internal-links-out-excessive";

import { R063_llmsTxtMissing } from "../R063-llms-txt-missing";
import { R064_llmsFullTxtMissing } from "../R064-llms-full-txt-missing";
import { R065_websiteSearchActionMissing } from "../R065-website-search-action-missing";
import { R066_sameAsThin } from "../R066-sameas-thin";
import { R067_faqSchemaNotUsed } from "../R067-faq-schema-not-used";
import { R068_howToSchemaNotUsed } from "../R068-howto-schema-not-used";
import { R069_authorSchemaMissingOnArticle } from "../R069-author-schema-missing-on-article";
import { R070_articleSchemaMissing } from "../R070-article-schema-missing";
import { R071_productSchemaMissing } from "../R071-product-schema-missing";
import { R072_localBusinessSchemaMissing } from "../R072-localbusiness-schema-missing";
import { R073_articleStale } from "../R073-article-stale";
import { R074_articleNoToc } from "../R074-article-no-toc";
import { R075_aggregateRatingMissing } from "../R075-aggregate-rating-missing";

import { ALL_RULES } from "../index";

describe("ALL_RULES registry", () => {
  it("contains exactly 75 rules", () => {
    expect(ALL_RULES.length).toBe(75);
  });
  it("uses unique rule IDs", () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ===========================================================================
// Technical
// ===========================================================================

describe("R001 page_non_ok_status", () => {
  it("does not fire on 200", () => {
    expect(R001_pageNonOkStatus.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on 404", () => {
    const p = makePage({ status_code: 404 });
    expect(R001_pageNonOkStatus.check(p, ctxFor(p))?.rule_id).toBe("R001");
  });
});

describe("R002 redirect_chain_too_long", () => {
  it("does not fire on a clean fetch", () => {
    expect(R002_redirectChainTooLong.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on a 3-hop chain", () => {
    const p = makePage({ redirect_chain: [{ url: "a", status: 301 }, { url: "b", status: 301 }, { url: "c", status: 200 }] });
    expect(R002_redirectChainTooLong.check(p, ctxFor(p))?.rule_id).toBe("R002");
  });
});

describe("R003 mixed_content", () => {
  it("does not fire when no mixed resources", () => {
    expect(R003_mixedContent.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when mixed_content_count > 0", () => {
    const p = makePage({ mixed_content_count: 4 });
    expect(R003_mixedContent.check(p, ctxFor(p))?.rule_id).toBe("R003");
  });
});

describe("R004 canonical_missing", () => {
  it("does not fire when canonical present", () => {
    expect(R004_canonicalMissing.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when canonical missing", () => {
    const p = makePage({ canonical_url: null });
    expect(R004_canonicalMissing.check(p, ctxFor(p))?.rule_id).toBe("R004");
  });
});

describe("R005 canonical_target_broken", () => {
  it("does not fire when canonical target is 200", () => {
    expect(R005_canonicalTargetBroken.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when canonical target is 404", () => {
    const p = makePage({ canonical_status_code: 404 });
    expect(R005_canonicalTargetBroken.check(p, ctxFor(p))?.rule_id).toBe("R005");
  });
});

describe("R006 canonical_cross_domain", () => {
  it("does not fire on same-domain canonical", () => {
    expect(R006_canonicalCrossDomain.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on different-domain canonical", () => {
    const p = makePage({ canonical_url: "https://other.com/about" });
    expect(R006_canonicalCrossDomain.check(p, ctxFor(p))?.rule_id).toBe("R006");
  });
});

describe("R007 noindex_in_sitemap", () => {
  it("does not fire on indexable page in sitemap", () => {
    expect(R007_noindexInSitemap.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on noindex page in sitemap", () => {
    const p = makePage({ noindex: true, in_sitemap: true });
    expect(R007_noindexInSitemap.check(p, ctxFor(p))?.rule_id).toBe("R007");
  });
});

describe("R008 noindex_on_nav_page", () => {
  it("does not fire when nav page is indexable", () => {
    const p = makePage({ is_nav_page: true });
    expect(R008_noindexOnNavPage.check(p, ctxFor(p))).toBeNull();
  });
  it("fires when nav page has noindex", () => {
    const p = makePage({ is_nav_page: true, noindex: true });
    expect(R008_noindexOnNavPage.check(p, ctxFor(p))?.rule_id).toBe("R008");
  });
});

describe("R009 robots_txt_missing", () => {
  it("does not fire when robots present", () => {
    expect(R009_robotsTxtMissing.check(ctxFor(makePage()))).toBeNull();
  });
  it("fires when robots missing", () => {
    const ctx = ctxFor(makePage(), makeSite({ robots_txt_present: false }));
    expect(R009_robotsTxtMissing.check(ctx)?.rule_id).toBe("R009");
  });
});

describe("R010 sitemap_missing", () => {
  it("does not fire when sitemap present", () => {
    expect(R010_sitemapMissing.check(ctxFor(makePage()))).toBeNull();
  });
  it("fires when sitemap missing", () => {
    const ctx = ctxFor(makePage(), makeSite({ sitemap_present: false }));
    expect(R010_sitemapMissing.check(ctx)?.rule_id).toBe("R010");
  });
});

describe("R011 sitemap_contains_broken_urls", () => {
  it("does not fire when sitemap urls are 200", () => {
    expect(R011_sitemapContainsBrokenUrls.check(ctxFor(makePage()))).toBeNull();
  });
  it("fires when a sitemap URL returns 404", () => {
    const broken = makePage({ url: "https://example.com/about", status_code: 404 });
    const ctx = ctxFor(broken, makeSite({ sitemap_urls: ["https://example.com/about"] }), [broken]);
    expect(R011_sitemapContainsBrokenUrls.check(ctx)?.rule_id).toBe("R011");
  });
});

describe("R012 sitemap_contains_noindex", () => {
  it("does not fire when sitemap is clean", () => {
    expect(R012_sitemapContainsNoindex.check(ctxFor(makePage()))).toBeNull();
  });
  it("fires when sitemap contains a noindex page", () => {
    const p = makePage({ url: "https://example.com/about", noindex: true });
    const ctx = ctxFor(p, makeSite({ sitemap_urls: ["https://example.com/about"] }), [p]);
    expect(R012_sitemapContainsNoindex.check(ctx)?.rule_id).toBe("R012");
  });
});

describe("R013 https_not_enforced", () => {
  it("does not fire when https enforced", () => {
    expect(R013_httpsNotEnforced.check(ctxFor(makePage()))).toBeNull();
  });
  it("fires when https not enforced", () => {
    const ctx = ctxFor(makePage(), makeSite({ https_enforced: false }));
    expect(R013_httpsNotEnforced.check(ctx)?.rule_id).toBe("R013");
  });
});

describe("R014 hsts_missing", () => {
  it("does not fire when HSTS present", () => {
    expect(R014_hstsMissing.check(ctxFor(makePage()))).toBeNull();
  });
  it("fires when HSTS absent", () => {
    const ctx = ctxFor(makePage(), makeSite({ hsts_header_present: false }));
    expect(R014_hstsMissing.check(ctx)?.rule_id).toBe("R014");
  });
});

describe("R015 response_time_slow", () => {
  it("does not fire under 3s", () => {
    expect(R015_responseTimeSlow.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires at 4s", () => {
    const p = makePage({ response_time_ms: 4000 });
    expect(R015_responseTimeSlow.check(p, ctxFor(p))?.rule_id).toBe("R015");
  });
});

describe("R016 response_time_critical", () => {
  it("does not fire at 4s", () => {
    const p = makePage({ response_time_ms: 4000 });
    expect(R016_responseTimeCritical.check(p, ctxFor(p))).toBeNull();
  });
  it("fires at 6s", () => {
    const p = makePage({ response_time_ms: 6000 });
    expect(R016_responseTimeCritical.check(p, ctxFor(p))?.rule_id).toBe("R016");
  });
});

describe("R017 rendered_html_oversized", () => {
  it("does not fire under 5MB", () => {
    expect(R017_renderedHtmlOversized.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires at 6MB", () => {
    const p = makePage({ rendered_html_size: 6 * 1024 * 1024 });
    expect(R017_renderedHtmlOversized.check(p, ctxFor(p))?.rule_id).toBe("R017");
  });
});

describe("R018 multiple_h1", () => {
  it("does not fire on single H1", () => {
    expect(R018_multipleH1.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on multiple H1s", () => {
    const p = makePage({ h1_count: 3 });
    expect(R018_multipleH1.check(p, ctxFor(p))?.rule_id).toBe("R018");
  });
});

describe("R019 skipped_heading_level", () => {
  it("does not fire when no skip", () => {
    expect(R019_skippedHeadingLevel.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when skip detected", () => {
    const p = makePage({ has_skipped_heading_level: true });
    expect(R019_skippedHeadingLevel.check(p, ctxFor(p))?.rule_id).toBe("R019");
  });
});

describe("R020 hreflang_invalid", () => {
  it("does not fire when hreflang valid", () => {
    expect(R020_hreflangInvalid.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when invalid flag set", () => {
    const p = makePage({ hreflang_invalid: true });
    expect(R020_hreflangInvalid.check(p, ctxFor(p))?.rule_id).toBe("R020");
  });
});

describe("R021 url_uppercase", () => {
  it("does not fire on lowercase URL", () => {
    expect(R021_urlUppercase.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on uppercase URL", () => {
    const p = makePage({ url: "https://example.com/About-Us" });
    expect(R021_urlUppercase.check(p, ctxFor(p))?.rule_id).toBe("R021");
  });
});

describe("R022 url_whitespace", () => {
  it("does not fire on clean URL", () => {
    expect(R022_urlWhitespace.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on URL with %20", () => {
    const p = makePage({ url: "https://example.com/about%20us" });
    expect(R022_urlWhitespace.check(p, ctxFor(p))?.rule_id).toBe("R022");
  });
});

// ===========================================================================
// On-page
// ===========================================================================

describe("R023 title_missing", () => {
  it("does not fire when title present", () => {
    expect(R023_titleMissing.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when title missing", () => {
    const p = makePage({ title: null });
    expect(R023_titleMissing.check(p, ctxFor(p))?.rule_id).toBe("R023");
  });
});

describe("R024 title_too_long", () => {
  it("does not fire under 60", () => {
    expect(R024_titleTooLong.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires over 60", () => {
    const p = makePage({ title: "x".repeat(80), title_length: 80 });
    expect(R024_titleTooLong.check(p, ctxFor(p))?.rule_id).toBe("R024");
  });
});

describe("R025 title_too_short", () => {
  it("does not fire over 30", () => {
    expect(R025_titleTooShort.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires under 30", () => {
    const p = makePage({ title: "Tiny", title_length: 4 });
    expect(R025_titleTooShort.check(p, ctxFor(p))?.rule_id).toBe("R025");
  });
});

describe("R026 title_duplicate", () => {
  it("does not fire on unique title", () => {
    const p1 = makePage({ id: "1", title: "Unique A" });
    const p2 = makePage({ id: "2", title: "Unique B" });
    expect(R026_titleDuplicate.check(p1, ctxFor(p1, makeSite(), [p1, p2]))).toBeNull();
  });
  it("fires on duplicate title", () => {
    const p1 = makePage({ id: "1", title: "Same" });
    const p2 = makePage({ id: "2", title: "Same" });
    expect(R026_titleDuplicate.check(p1, ctxFor(p1, makeSite(), [p1, p2]))?.rule_id).toBe("R026");
  });
});

describe("R027 title_generic", () => {
  it("does not fire on a descriptive title", () => {
    expect(R027_titleGeneric.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on \"Welcome\"", () => {
    const p = makePage({ title: "Welcome" });
    expect(R027_titleGeneric.check(p, ctxFor(p))?.rule_id).toBe("R027");
  });
});

describe("R028 meta_description_missing", () => {
  it("does not fire when present", () => {
    expect(R028_metaDescriptionMissing.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when missing", () => {
    const p = makePage({ meta_description: null });
    expect(R028_metaDescriptionMissing.check(p, ctxFor(p))?.rule_id).toBe("R028");
  });
});

describe("R029 meta_description_too_long", () => {
  it("does not fire under 160", () => {
    expect(R029_metaDescriptionTooLong.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires over 160", () => {
    const p = makePage({ meta_description_length: 200 });
    expect(R029_metaDescriptionTooLong.check(p, ctxFor(p))?.rule_id).toBe("R029");
  });
});

describe("R030 meta_description_too_short", () => {
  it("does not fire at 117", () => {
    expect(R030_metaDescriptionTooShort.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires under 70", () => {
    const p = makePage({ meta_description: "Short", meta_description_length: 5 });
    expect(R030_metaDescriptionTooShort.check(p, ctxFor(p))?.rule_id).toBe("R030");
  });
});

describe("R031 meta_description_duplicate", () => {
  it("does not fire on unique description", () => {
    const p1 = makePage({ id: "1", meta_description: "Unique one description text content here that is plenty long enough to pass" });
    const p2 = makePage({ id: "2", meta_description: "Unique two description text content here that is plenty long enough to pass" });
    expect(R031_metaDescriptionDuplicate.check(p1, ctxFor(p1, makeSite(), [p1, p2]))).toBeNull();
  });
  it("fires on duplicate", () => {
    const p1 = makePage({ id: "1", meta_description: "Same description" });
    const p2 = makePage({ id: "2", meta_description: "Same description" });
    expect(R031_metaDescriptionDuplicate.check(p1, ctxFor(p1, makeSite(), [p1, p2]))?.rule_id).toBe("R031");
  });
});

describe("R032 meta_description_matches_title", () => {
  it("does not fire when distinct", () => {
    expect(R032_metaDescriptionMatchesTitle.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when identical", () => {
    const p = makePage({ title: "Same Text", meta_description: "Same Text" });
    expect(R032_metaDescriptionMatchesTitle.check(p, ctxFor(p))?.rule_id).toBe("R032");
  });
});

describe("R033 h1_missing", () => {
  it("does not fire when H1 present", () => {
    expect(R033_h1Missing.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when H1 missing", () => {
    const p = makePage({ h1_count: 0 });
    expect(R033_h1Missing.check(p, ctxFor(p))?.rule_id).toBe("R033");
  });
});

describe("R034 h1_generic", () => {
  it("does not fire on descriptive H1", () => {
    expect(R034_h1Generic.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on Welcome", () => {
    const p = makePage({ h1_text: "Welcome" });
    expect(R034_h1Generic.check(p, ctxFor(p))?.rule_id).toBe("R034");
  });
});

describe("R035 og_title_missing", () => {
  it("does not fire when present", () => {
    expect(R035_ogTitleMissing.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when missing", () => {
    const p = makePage({ og_title: null });
    expect(R035_ogTitleMissing.check(p, ctxFor(p))?.rule_id).toBe("R035");
  });
});

describe("R036 og_image_missing", () => {
  it("does not fire when present", () => {
    expect(R036_ogImageMissing.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when missing", () => {
    const p = makePage({ og_image: null });
    expect(R036_ogImageMissing.check(p, ctxFor(p))?.rule_id).toBe("R036");
  });
});

describe("R037 og_image_broken", () => {
  it("does not fire when og_image is 200", () => {
    expect(R037_ogImageBroken.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when og_image returns 404", () => {
    const p = makePage({ og_image_status: 404 });
    expect(R037_ogImageBroken.check(p, ctxFor(p))?.rule_id).toBe("R037");
  });
});

describe("R038 twitter_card_missing", () => {
  it("does not fire when present", () => {
    expect(R038_twitterCardMissing.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when missing", () => {
    const p = makePage({ twitter_card: null });
    expect(R038_twitterCardMissing.check(p, ctxFor(p))?.rule_id).toBe("R038");
  });
});

describe("R039 jsonld_invalid", () => {
  it("does not fire when all valid", () => {
    expect(R039_jsonldInvalid.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when there is an invalid block", () => {
    const p = makePage({ schema_invalid_count: 1 });
    expect(R039_jsonldInvalid.check(p, ctxFor(p))?.rule_id).toBe("R039");
  });
});

describe("R040 organization_schema_missing_on_home", () => {
  it("does not fire on non-home", () => {
    expect(R040_organizationSchemaMissingOnHome.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on home with no Organization", () => {
    const p = makePage({ page_type: "home", schema_types: ["WebPage"] });
    expect(R040_organizationSchemaMissingOnHome.check(p, ctxFor(p))?.rule_id).toBe("R040");
  });
});

describe("R041 alt_text_missing", () => {
  it("does not fire when all alts present", () => {
    expect(R041_altTextMissing.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when alt missing on images", () => {
    const p = makePage({ alt_text_missing_count: 3 });
    expect(R041_altTextMissing.check(p, ctxFor(p))?.rule_id).toBe("R041");
  });
});

describe("R042 alt_text_too_long", () => {
  it("does not fire when alts are concise", () => {
    expect(R042_altTextTooLong.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when alts exceed 125 chars", () => {
    const p = makePage({ alt_text_too_long_count: 2 });
    expect(R042_altTextTooLong.check(p, ctxFor(p))?.rule_id).toBe("R042");
  });
});

describe("R043 alt_text_filename", () => {
  it("does not fire on descriptive alt", () => {
    expect(R043_altTextFilename.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when alt matches filename", () => {
    const p = makePage({ alt_text_filename_count: 2 });
    expect(R043_altTextFilename.check(p, ctxFor(p))?.rule_id).toBe("R043");
  });
});

describe("R044 all_caps_heading", () => {
  it("does not fire on title-case headings", () => {
    expect(R044_allCapsHeading.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on all-caps heading", () => {
    const p = makePage({ headings: [{ level: 2, text: "BIG SHOUTY HEADING" }] });
    expect(R044_allCapsHeading.check(p, ctxFor(p))?.rule_id).toBe("R044");
  });
});

// ===========================================================================
// Content
// ===========================================================================

describe("R045 word_count_thin", () => {
  it("does not fire on 600 words", () => {
    expect(R045_wordCountThin.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on 200 words", () => {
    const p = makePage({ word_count: 200 });
    expect(R045_wordCountThin.check(p, ctxFor(p))?.rule_id).toBe("R045");
  });
});

describe("R046 word_count_extremely_thin", () => {
  it("does not fire on 600 words", () => {
    expect(R046_wordCountExtremelyThin.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on 50 words", () => {
    const p = makePage({ word_count: 50 });
    expect(R046_wordCountExtremelyThin.check(p, ctxFor(p))?.rule_id).toBe("R046");
  });
});

describe("R047 zero_outbound_internal_links", () => {
  it("does not fire when links exist", () => {
    expect(R047_zeroOutboundInternalLinks.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires on zero", () => {
    const p = makePage({ internal_links_out: 0 });
    expect(R047_zeroOutboundInternalLinks.check(p, ctxFor(p))?.rule_id).toBe("R047");
  });
});

describe("R048 orphan_page", () => {
  it("does not fire when inbound > 0", () => {
    expect(R048_orphanPage.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when inbound = 0", () => {
    const p = makePage({ internal_links_in: 0 });
    expect(R048_orphanPage.check(p, ctxFor(p))?.rule_id).toBe("R048");
  });
});

describe("R049 single_inbound_link", () => {
  it("does not fire when inbound > 1", () => {
    expect(R049_singleInboundLink.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when inbound = 1", () => {
    const p = makePage({ internal_links_in: 1 });
    expect(R049_singleInboundLink.check(p, ctxFor(p))?.rule_id).toBe("R049");
  });
});

describe("R050 click_depth_excessive", () => {
  it("does not fire at depth 1", () => {
    expect(R050_clickDepthExcessive.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires at depth 6", () => {
    const p = makePage({ click_depth: 6 });
    expect(R050_clickDepthExcessive.check(p, ctxFor(p))?.rule_id).toBe("R050");
  });
});

describe("R051 broken_internal_links", () => {
  it("does not fire when no broken", () => {
    expect(R051_brokenInternalLinks.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when same-host link is broken", () => {
    const p = makePage({ broken_links_out: [{ url: "https://example.com/dead", status: 404 }] });
    expect(R051_brokenInternalLinks.check(p, ctxFor(p))?.rule_id).toBe("R051");
  });
});

describe("R052 broken_external_links", () => {
  it("does not fire when no broken", () => {
    expect(R052_brokenExternalLinks.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when external link is broken", () => {
    const p = makePage({ broken_links_out: [{ url: "https://other.com/dead", status: 404 }] });
    expect(R052_brokenExternalLinks.check(p, ctxFor(p))?.rule_id).toBe("R052");
  });
});

describe("R053 generic_anchor_excessive", () => {
  it("does not fire when 0 generic", () => {
    expect(R053_genericAnchorExcessive.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when 5 generic anchors", () => {
    const p = makePage({ generic_anchor_count: 5 });
    expect(R053_genericAnchorExcessive.check(p, ctxFor(p))?.rule_id).toBe("R053");
  });
});

describe("R054 unsafe_blank_target", () => {
  it("does not fire when 0", () => {
    expect(R054_unsafeBlankTarget.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when count > 0", () => {
    const p = makePage({ unsafe_blank_target_count: 2 });
    expect(R054_unsafeBlankTarget.check(p, ctxFor(p))?.rule_id).toBe("R054");
  });
});

describe("R055 duplicate_content", () => {
  it("does not fire when not duplicate", () => {
    expect(R055_duplicateContent.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when duplicate_of_url is set", () => {
    const p = makePage({ duplicate_of_url: "https://example.com/original" });
    expect(R055_duplicateContent.check(p, ctxFor(p))?.rule_id).toBe("R055");
  });
});

describe("R056 text_to_html_low", () => {
  it("does not fire at 25%", () => {
    expect(R056_textToHtmlLow.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires at 5%", () => {
    const p = makePage({ text_to_html_ratio: 0.05 });
    expect(R056_textToHtmlLow.check(p, ctxFor(p))?.rule_id).toBe("R056");
  });
});

describe("R057 placeholder_text", () => {
  it("does not fire when none found", () => {
    expect(R057_placeholderText.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when lorem ipsum found", () => {
    const p = makePage({ placeholder_text_found: ["lorem ipsum"] });
    expect(R057_placeholderText.check(p, ctxFor(p))?.rule_id).toBe("R057");
  });
});

describe("R058 unsubstituted_template_vars", () => {
  it("does not fire when none found", () => {
    expect(R058_unsubstitutedTemplateVars.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when {{ var }} found", () => {
    const p = makePage({ unsubstituted_vars: ["{{ name }}"] });
    expect(R058_unsubstitutedTemplateVars.check(p, ctxFor(p))?.rule_id).toBe("R058");
  });
});

describe("R059 table_without_header", () => {
  it("does not fire when tables have headers", () => {
    expect(R059_tableWithoutHeader.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when flagged", () => {
    const p = makePage({ has_table_without_header: true });
    expect(R059_tableWithoutHeader.check(p, ctxFor(p))?.rule_id).toBe("R059");
  });
});

describe("R060 single_item_list", () => {
  it("does not fire when lists are normal", () => {
    expect(R060_singleItemList.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when flagged", () => {
    const p = makePage({ has_single_item_list: true });
    expect(R060_singleItemList.check(p, ctxFor(p))?.rule_id).toBe("R060");
  });
});

describe("R061 article_no_images", () => {
  it("does not fire on article with images", () => {
    const p = makePage({ page_type: "article", word_count: 1500 });
    expect(R061_articleNoImages.check(p, ctxFor(p))).toBeNull();
  });
  it("fires on long article with no images", () => {
    const p = makePage({ page_type: "article", word_count: 1500, images_count: 0 });
    expect(R061_articleNoImages.check(p, ctxFor(p))?.rule_id).toBe("R061");
  });
});

describe("R062 internal_links_out_excessive", () => {
  it("does not fire under 200", () => {
    expect(R062_internalLinksOutExcessive.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires at 250", () => {
    const p = makePage({ internal_links_out: 250 });
    expect(R062_internalLinksOutExcessive.check(p, ctxFor(p))?.rule_id).toBe("R062");
  });
});

// ===========================================================================
// AI-GEO
// ===========================================================================

describe("R063 llms_txt_missing", () => {
  it("does not fire when llms.txt present", () => {
    expect(R063_llmsTxtMissing.check(ctxFor(makePage()))).toBeNull();
  });
  it("fires when missing", () => {
    const ctx = ctxFor(makePage(), makeSite({ llms_txt_present: false }));
    expect(R063_llmsTxtMissing.check(ctx)?.rule_id).toBe("R063");
  });
});

describe("R064 llms_full_txt_missing", () => {
  it("does not fire when present", () => {
    expect(R064_llmsFullTxtMissing.check(ctxFor(makePage()))).toBeNull();
  });
  it("fires when missing", () => {
    const ctx = ctxFor(makePage(), makeSite({ llms_full_txt_present: false }));
    expect(R064_llmsFullTxtMissing.check(ctx)?.rule_id).toBe("R064");
  });
});

describe("R065 website_search_action_missing", () => {
  it("does not fire when SearchAction present", () => {
    const p = makePage({
      page_type: "home",
      schema_types: ["WebSite"],
      schema_blocks: [{ "@type": "WebSite", potentialAction: { "@type": "SearchAction" } }],
    });
    expect(R065_websiteSearchActionMissing.check(p, ctxFor(p))).toBeNull();
  });
  it("fires when WebSite has no SearchAction", () => {
    const p = makePage({
      page_type: "home",
      schema_types: ["WebSite"],
      schema_blocks: [{ "@type": "WebSite", name: "Site" }],
    });
    expect(R065_websiteSearchActionMissing.check(p, ctxFor(p))?.rule_id).toBe("R065");
  });
});

describe("R066 sameAs_thin", () => {
  it("does not fire with 3 sameAs", () => {
    const p = makePage({
      page_type: "home",
      schema_types: ["Organization"],
      schema_blocks: [{ "@type": "Organization", sameAs: ["a", "b", "c"] }],
    });
    expect(R066_sameAsThin.check(p, ctxFor(p))).toBeNull();
  });
  it("fires with 1 sameAs", () => {
    const p = makePage({
      page_type: "home",
      schema_types: ["Organization"],
      schema_blocks: [{ "@type": "Organization", sameAs: ["a"] }],
    });
    expect(R066_sameAsThin.check(p, ctxFor(p))?.rule_id).toBe("R066");
  });
});

describe("R067 faq_schema_not_used", () => {
  it("does not fire when no FAQ format", () => {
    expect(R067_faqSchemaNotUsed.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when FAQ format detected without schema", () => {
    const p = makePage({ has_faq_format: true });
    expect(R067_faqSchemaNotUsed.check(p, ctxFor(p))?.rule_id).toBe("R067");
  });
});

describe("R068 howto_schema_not_used", () => {
  it("does not fire when no numbered steps", () => {
    expect(R068_howToSchemaNotUsed.check(makePage(), ctxFor(makePage()))).toBeNull();
  });
  it("fires when steps detected without schema", () => {
    const p = makePage({ has_numbered_steps: true });
    expect(R068_howToSchemaNotUsed.check(p, ctxFor(p))?.rule_id).toBe("R068");
  });
});

describe("R069 author_schema_missing_on_article", () => {
  it("does not fire when author present", () => {
    const p = makePage({
      page_type: "article",
      schema_types: ["Article"],
      schema_blocks: [{ "@type": "Article", author: { "@type": "Person", name: "Jane" } }],
    });
    expect(R069_authorSchemaMissingOnArticle.check(p, ctxFor(p))).toBeNull();
  });
  it("fires when Article has no author", () => {
    const p = makePage({
      page_type: "article",
      schema_types: ["Article"],
      schema_blocks: [{ "@type": "Article", headline: "Hi" }],
    });
    expect(R069_authorSchemaMissingOnArticle.check(p, ctxFor(p))?.rule_id).toBe("R069");
  });
});

describe("R070 article_schema_missing", () => {
  it("does not fire when Article schema present", () => {
    const p = makePage({ page_type: "article", schema_types: ["Article"] });
    expect(R070_articleSchemaMissing.check(p, ctxFor(p))).toBeNull();
  });
  it("fires when missing on article", () => {
    const p = makePage({ page_type: "article", schema_types: ["WebPage"] });
    expect(R070_articleSchemaMissing.check(p, ctxFor(p))?.rule_id).toBe("R070");
  });
});

describe("R071 product_schema_missing", () => {
  it("does not fire on product with schema", () => {
    const p = makePage({ page_type: "product", schema_types: ["Product"] });
    expect(R071_productSchemaMissing.check(p, ctxFor(p))).toBeNull();
  });
  it("fires on product without schema", () => {
    const p = makePage({ page_type: "product", schema_types: ["WebPage"] });
    expect(R071_productSchemaMissing.check(p, ctxFor(p))?.rule_id).toBe("R071");
  });
});

describe("R072 localbusiness_schema_missing", () => {
  it("does not fire when no address detected", () => {
    const p = makePage({ page_type: "home", schema_types: ["Organization"] });
    expect(R072_localBusinessSchemaMissing.check(p, ctxFor(p))).toBeNull();
  });
  it("fires when address present but no LocalBusiness", () => {
    const p = makePage({
      page_type: "home",
      schema_types: ["Organization"],
      schema_blocks: [{ "@type": "Organization", address: { streetAddress: "1 Main" } }],
    });
    expect(R072_localBusinessSchemaMissing.check(p, ctxFor(p))?.rule_id).toBe("R072");
  });
});

describe("R073 article_stale", () => {
  it("does not fire on recent article", () => {
    const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const p = makePage({ page_type: "article", date_published: recent });
    expect(R073_articleStale.check(p, ctxFor(p))).toBeNull();
  });
  it("fires on old article without modification", () => {
    const old = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const p = makePage({ page_type: "article", date_published: old, date_modified: null });
    expect(R073_articleStale.check(p, ctxFor(p))?.rule_id).toBe("R073");
  });
});

describe("R074 article_no_toc", () => {
  it("does not fire on short article", () => {
    const p = makePage({ page_type: "article", word_count: 800 });
    expect(R074_articleNoToc.check(p, ctxFor(p))).toBeNull();
  });
  it("fires on 3000-word article without TOC", () => {
    const p = makePage({ page_type: "article", word_count: 3000, has_table_of_contents: false });
    expect(R074_articleNoToc.check(p, ctxFor(p))?.rule_id).toBe("R074");
  });
});

describe("R075 aggregate_rating_missing", () => {
  it("does not fire when aggregateRating present", () => {
    const p = makePage({
      page_type: "product",
      schema_types: ["Product"],
      schema_blocks: [{ "@type": "Product", aggregateRating: { ratingValue: 4.5 } }],
    });
    expect(R075_aggregateRatingMissing.check(p, ctxFor(p))).toBeNull();
  });
  it("fires when Product has no rating", () => {
    const p = makePage({
      page_type: "product",
      schema_types: ["Product"],
      schema_blocks: [{ "@type": "Product", name: "Widget" }],
    });
    expect(R075_aggregateRatingMissing.check(p, ctxFor(p))?.rule_id).toBe("R075");
  });
});
