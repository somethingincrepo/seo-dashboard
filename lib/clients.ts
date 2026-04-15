import { airtableFetch } from "./airtable";

export type AirtableRecord<T> = { id: string; fields: T; createdTime: string };

export type ClientFields = {
  // Core identity
  client_id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  billing_email: string;
  site_url: string;

  // Tech & CMS
  cms: string;
  seo_plugin: string;
  page_builder: string;

  // SEO strategy
  keywords: string;
  competitors: string;
  pivot_context: string;
  excluded_pages: string;
  nav_pages: string;
  brand_voice_links: string;
  claims_no_generate: string;
  content_approver: string;
  customer_questions: string;
  sales_questions: string;
  brand_guidelines_url: string;
  additional_sites: string;

  // Pipeline & scheduling
  status: string;           // NEW — use this (8 statuses)
  plan_status: string;      // OLD — legacy compat
  approval_turnaround: string;
  approval_channel: string;
  report_day: number;
  month_number: number;
  next_scheduled_run: string;

  // WordPress CMS credentials (stored in Airtable, read by implement_wordpress SOP)
  wp_username: string;
  wp_app_password: string;
  cloudflare_zone: string;
  cloudflare_token: string;

  // Integrations
  sheet_id: string;
  drive_folder_id: string;
  gsc_property: string;
  ga4_property: string;  // numeric GA4 property ID (e.g. "123456789")
  creds_ref: string;
  portal_token: string;

  // Content strategy (populated by SOP 14 after Month 1 audit)
  keyword_groups: string; // JSON string: KeywordGroup[] — AI-generated, overwritten on SOP 14 re-run
  custom_keyword_groups: string; // JSON string: KeywordGroup[] — client-added; never overwritten by agent runs
  content_tone: string;   // B2B SaaS | B2B Services | Healthcare | E-commerce | Professional Services
  content_audience: string;

  // Portal credentials (username/password login)
  portal_username: string;
  portal_password_hash: string;
  portal_password: string; // plaintext — stored for admin reference

  // Package & audit scope
  package: "starter" | "growth" | "authority";
  site_page_count: number;      // set by audit_inventory after crawl
  audit_scope_tier: "full" | "priority" | "top_traffic"; // derived from site_page_count

  // Misc
  notes: string;
};

export type Client = AirtableRecord<ClientFields>;

const TABLE = "Clients";

export async function getClients(): Promise<Client[]> {
  return airtableFetch<Client>(TABLE, {
    sort: [{ field: "company_name", direction: "asc" }],
  });
}

export async function getClient(recordId: string): Promise<Client | null> {
  const clients = await airtableFetch<Client>(TABLE, {
    filterByFormula: `RECORD_ID()="${recordId}"`,
  });
  return clients[0] ?? null;
}

export async function getClientByToken(token: string): Promise<Client | null> {
  const clients = await airtableFetch<Client>(TABLE, {
    filterByFormula: `{portal_token}="${token}"`,
  });
  return clients[0] ?? null;
}

export async function getClientByUsername(
  username: string
): Promise<Client | null> {
  const clients = await airtableFetch<Client>(TABLE, {
    filterByFormula: `{portal_username}="${username}"`,
    maxRecords: 1,
  });
  return clients[0] ?? null;
}
