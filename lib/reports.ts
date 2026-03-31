import { airtableFetch } from "./airtable";
import type { AirtableRecord } from "./clients";

export type ReportFields = {
  report_id: string;
  client_id: string;
  month: number;
  pdf_url: string;
  sent_at: string;
  changes_made: number;
  changes_by_category: string;
  gsc_clicks_delta: number;
  gsc_impressions_delta: number;
  gsc_avg_position_delta: number;
  ai_citation_score: number;
  ai_citation_delta: number;
  next_month_priorities: string;
  reddit_highlights: string;
};

export type Report = AirtableRecord<ReportFields>;

const TABLE = "Reports";

export async function getClientReports(clientId: string): Promise<Report[]> {
  return airtableFetch<Report>(TABLE, {
    filterByFormula: `FIND("${clientId}",ARRAYJOIN({client_id}))`,
    sort: [{ field: "sent_at", direction: "desc" }],
  });
}

export async function getAllReports(): Promise<Report[]> {
  return airtableFetch<Report>(TABLE, {
    sort: [{ field: "sent_at", direction: "desc" }],
    maxRecords: 100,
  });
}
