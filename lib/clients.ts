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

  // Integrations
  sheet_id: string;
  drive_folder_id: string;
  gsc_property: string;
  creds_ref: string;
  portal_token: string;

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
