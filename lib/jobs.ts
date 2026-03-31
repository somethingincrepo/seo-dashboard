import { airtableFetch } from "./airtable";
import type { AirtableRecord } from "./clients";

export type JobFields = {
  job_id: number;
  client_id: string[];
  type: string;
  job_status: string;
  params: string;
  run_id: string;
  error_message: string;
  started_at: string;
  completed_at: string;
  triggered_by: string;
};

export type Job = AirtableRecord<JobFields>;

const TABLE = process.env.AIRTABLE_JOBS_TABLE || "Jobs";

export async function getJobs(limit = 50): Promise<Job[]> {
  return airtableFetch<Job>(TABLE, {
    sort: JSON.stringify([{ field: "started_at", direction: "desc" }]),
    maxRecords: String(limit),
  });
}

export async function getClientJobs(clientRecordId: string): Promise<Job[]> {
  return airtableFetch<Job>(TABLE, {
    filterByFormula: `FIND("${clientRecordId}", ARRAYJOIN({client_id}))`,
    sort: JSON.stringify([{ field: "started_at", direction: "desc" }]),
  });
}

export async function getActiveJobs(): Promise<Job[]> {
  return airtableFetch<Job>(TABLE, {
    filterByFormula: `OR({job_status}="queued",{job_status}="running",{job_status}="implementing")`,
  });
}
