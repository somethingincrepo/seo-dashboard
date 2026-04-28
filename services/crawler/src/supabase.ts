import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PostCrawlOutput } from "./post-crawl.js";
import type { SiteChecksResult } from "./site-checks.js";

let _client: SupabaseClient | null = null;

export function supa(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export async function setRunStatus(
  auditRunId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supa().from("audit_runs").update(patch).eq("id", auditRunId);
  if (error) throw new Error(`audit_runs update failed: ${error.message}`);
}

export async function writeSiteData(auditRunId: string, site: SiteChecksResult): Promise<void> {
  await setRunStatus(auditRunId, {
    robots_txt_present: site.robots_txt_present,
    robots_txt_content: site.robots_txt_content,
    sitemap_present: site.sitemap_present,
    sitemap_urls: site.sitemap_urls,
    sitemap_url_count: site.sitemap_urls.length,
    llms_txt_present: site.llms_txt_present,
    llms_full_txt_present: site.llms_full_txt_present,
    https_enforced: site.https_enforced,
    hsts_header_present: site.hsts_header_present,
  });
}

export async function writePages(
  auditRunId: string,
  clientId: string,
  rows: PostCrawlOutput[],
): Promise<void> {
  const dbRows = rows.map((r) => ({
    audit_run_id: auditRunId,
    client_id: clientId,
    url: r.url,
    status_code: r.status_code,
    redirect_target: r.redirect_target,
    redirect_chain: r.redirect_chain,
    response_time_ms: r.response_time_ms,
    rendered_html_size: r.rendered_html_size,
    is_https: r.is_https,
    mixed_content_count: r.mixed_content_count,
    title: r.title,
    title_length: r.title_length,
    meta_description: r.meta_description,
    meta_description_length: r.meta_description_length,
    h1_text: r.h1_text,
    h1_count: r.h1_count,
    h2_count: r.h2_count,
    h3_count: r.h3_count,
    headings: r.headings,
    has_skipped_heading_level: r.has_skipped_heading_level,
    canonical_url: r.canonical_url,
    canonical_self_referencing: r.canonical_self_referencing,
    canonical_status_code: r.canonical_status_code,
    is_indexable: r.is_indexable,
    noindex: r.noindex,
    nofollow: r.nofollow,
    in_sitemap: r.in_sitemap,
    schema_types: r.schema_types,
    schema_blocks: r.schema_blocks,
    schema_invalid_count: r.schema_invalid_count,
    og_title: r.og_title,
    og_description: r.og_description,
    og_image: r.og_image,
    og_image_status: r.og_image_status,
    og_type: r.og_type,
    twitter_card: r.twitter_card,
    hreflang_tags: r.hreflang_tags,
    hreflang_invalid: r.hreflang_invalid,
    internal_links_out: r.internal_links_out,
    internal_links_in: r.internal_links_in,
    external_links_out: r.external_links_out,
    broken_links_out: r.broken_links_out,
    generic_anchor_count: r.generic_anchor_count,
    unsafe_blank_target_count: r.unsafe_blank_target_count,
    click_depth: r.click_depth,
    word_count: r.word_count,
    text_to_html_ratio: r.text_to_html_ratio,
    content_hash: r.content_hash,
    duplicate_of_url: r.duplicate_of_url,
    images_count: r.images_count,
    alt_text_missing_count: r.alt_text_missing_count,
    alt_text_empty_count: r.alt_text_empty_count,
    alt_text_too_long_count: r.alt_text_too_long_count,
    alt_text_filename_count: r.alt_text_filename_count,
    alt_text_duplicate_count: r.alt_text_duplicate_count,
    placeholder_text_found: r.placeholder_text_found,
    unsubstituted_vars: r.unsubstituted_vars,
    has_faq_format: r.has_faq_format,
    has_numbered_steps: r.has_numbered_steps,
    has_table_without_header: r.has_table_without_header,
    has_single_item_list: r.has_single_item_list,
    date_published: r.date_published,
    date_modified: r.date_modified,
    has_author: r.has_author,
    has_table_of_contents: r.has_table_of_contents,
    page_type: r.page_type,
    is_nav_page: r.is_nav_page,
  }));

  // Bulk insert in chunks to stay under PostgREST size limits
  const CHUNK = 200;
  for (let i = 0; i < dbRows.length; i += CHUNK) {
    const slice = dbRows.slice(i, i + CHUNK);
    const { error } = await supa().from("pages").insert(slice);
    if (error) throw new Error(`pages insert failed at chunk ${i / CHUNK}: ${error.message}`);
  }
}
