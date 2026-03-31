import { airtableFetch } from "./airtable";
import type { AirtableRecord } from "./clients";

export type JobFields = {
  job_id: string;
  client_id: string;
  job_type: string;   // primary type field
  type: string;       // alternate type field
  job_status: string; // primary status field
  status: string;     // alternate status field
  params: string;
  run_id: string;
  error_message: string;
  agent_log_url: string;
  started_at: string;
  completed_at: string;
  triggered_by: string;
};

export type Job = AirtableRecord<JobFields>;

const TABLE = "Jobs";

export async function getJobs(limit = 50): Promise<Job[]> {
  return airtableFetch<Job>(TABLE, {
    sort: [{ field: "started_at", direction: "desc" }],
    maxRecords: limit,
  });
}

export async function getClientJobs(clientId: string): Promise<Job[]> {
  return airtableFetch<Job>(TABLE, {
    filterByFormula: `FIND("${clientId}", ARRAYJOIN({client_id}))`,
    sort: [{ field: "started_at", direction: "desc" }],
  });
}

export async function getActiveJobs(): Promise<Job[]> {
  return airtableFetch<Job>(TABLE, {
    filterByFormula: `OR({job_status}="queued",{job_status}="running",{job_status}="implementing",{status}="queued",{status}="running")`,
  });
}
