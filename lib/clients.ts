import { airtableFetch } from "./airtable";

export type AirtableRecord<T> = { id: string; fields: T; createdTime: string };

export type ClientFields = {
  client_id: string;
  company_name: string;
  site_url: string;
  cms: string;
  plan_status: string;
  contact_name: string;
  contact_email: string;
  sheet_id: string;
  drive_folder_id: string;
  gsc_property: string;
  approval_channel: string;
  report_day: number;
  month_number: number;
  next_scheduled_run: string;
  portal_token: string;
  notes: string;
};

export type Client = AirtableRecord<ClientFields>;

const TABLE = process.env.AIRTABLE_CLIENTS_TABLE || "Clients";

export async function getClients(): Promise<Client[]> {
  return airtableFetch<Client>(TABLE, {
    sort: JSON.stringify([{ field: "company_name", direction: "asc" }]),
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

export async function getClientByClientId(clientId: string): Promise<Client | null> {
  const clients = await airtableFetch<Client>(TABLE, {
    filterByFormula: `{client_id}="${clientId}"`,
  });
  return clients[0] ?? null;
}
