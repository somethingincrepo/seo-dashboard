import type Anthropic from "@anthropic-ai/sdk";

const BASE_URL = "https://api.airtable.com/v0";
type Base = "main" | "content";

function getBaseId(base: Base): string {
  const id =
    base === "content"
      ? process.env.CONTENT_AIRTABLE_BASE_ID
      : process.env.AIRTABLE_BASE_ID;
  if (!id) throw new Error(`Airtable base ID not configured for: ${base}`);
  return id;
}

function getApiKey(base: Base): string {
  const key =
    base === "content"
      ? process.env.CONTENT_AIRTABLE_API_KEY
      : process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error(`Airtable API key not configured for: ${base}`);
  return key;
}

function makeHeaders(base: Base) {
  return {
    Authorization: `Bearer ${getApiKey(base)}`,
    "Content-Type": "application/json",
  };
}

// --- Tool definitions ---

export const airtableFetchDefinition: Anthropic.Messages.Tool = {
  name: "airtable_fetch",
  description: "Fetch records from an Airtable table. Returns an array of records with id and fields.",
  input_schema: {
    type: "object" as const,
    properties: {
      base: {
        type: "string",
        enum: ["main", "content"],
        description: "'main' = Clients/Changes/Reports base. 'content' = Content Titles base.",
      },
      table: { type: "string", description: "Table name or table ID" },
      filter: {
        type: "string",
        description: "Airtable formula filter, e.g. \"{Status}='Active'\"",
      },
      max_records: { type: "number", description: "Max records to return (default: 100)" },
      view: { type: "string", description: "View name to use" },
    },
    required: ["base", "table"],
  },
};

export const airtableCreateDefinition: Anthropic.Messages.Tool = {
  name: "airtable_create",
  description: "Create a new record in an Airtable table. Returns the new record ID.",
  input_schema: {
    type: "object" as const,
    properties: {
      base: { type: "string", enum: ["main", "content"] },
      table: { type: "string", description: "Table name or table ID" },
      fields: {
        type: "object",
        description: "Field values for the new record",
        additionalProperties: true,
      },
    },
    required: ["base", "table", "fields"],
  },
};

export const airtablePatchDefinition: Anthropic.Messages.Tool = {
  name: "airtable_patch",
  description: "Update fields on an existing Airtable record.",
  input_schema: {
    type: "object" as const,
    properties: {
      base: { type: "string", enum: ["main", "content"] },
      table: { type: "string", description: "Table name or table ID" },
      record_id: {
        type: "string",
        description: "Airtable record ID (starts with 'rec')",
      },
      fields: {
        type: "object",
        description: "Fields to update",
        additionalProperties: true,
      },
    },
    required: ["base", "table", "record_id", "fields"],
  },
};

// --- Implementations ---

type FetchInput = {
  base: Base;
  table: string;
  filter?: string;
  max_records?: number;
  view?: string;
};

type CreateInput = {
  base: Base;
  table: string;
  fields: Record<string, unknown>;
};

type PatchInput = {
  base: Base;
  table: string;
  record_id: string;
  fields: Record<string, unknown>;
};

export async function executeAirtableFetch(
  input: FetchInput
): Promise<{ records: unknown[] }> {
  const { base, table, filter, max_records = 100, view } = input;
  const baseId = getBaseId(base);
  const records: unknown[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${BASE_URL}/${baseId}/${encodeURIComponent(table)}`);
    if (filter) url.searchParams.set("filterByFormula", filter);
    if (max_records) url.searchParams.set("maxRecords", String(max_records));
    if (view) url.searchParams.set("view", view);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: makeHeaders(base),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`airtable_fetch ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    records.push(...(data.records as unknown[]));
    offset = data.offset as string | undefined;
  } while (offset && records.length < max_records);

  return { records };
}

export async function executeAirtableCreate(
  input: CreateInput
): Promise<{ id: string }> {
  const { base, table, fields } = input;
  const baseId = getBaseId(base);

  const res = await fetch(`${BASE_URL}/${baseId}/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: makeHeaders(base),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`airtable_create ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return { id: data.id as string };
}

export async function executeAirtablePatch(
  input: PatchInput
): Promise<{ ok: boolean }> {
  const { base, table, record_id, fields } = input;
  const baseId = getBaseId(base);

  const res = await fetch(
    `${BASE_URL}/${baseId}/${encodeURIComponent(table)}/${record_id}`,
    {
      method: "PATCH",
      headers: makeHeaders(base),
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) {
    throw new Error(`airtable_patch ${res.status}: ${await res.text()}`);
  }
  return { ok: true };
}
