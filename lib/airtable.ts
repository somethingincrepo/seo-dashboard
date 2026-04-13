const BASE_URL = "https://api.airtable.com/v0";

type SortItem = { field: string; direction?: "asc" | "desc" };

export type AirtableParams = {
  filterByFormula?: string;
  maxRecords?: number;
  sort?: SortItem[];
  view?: string;
  fields?: string[];
};

function getHeaders() {
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error("AIRTABLE_API_KEY is not set");
  }
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function buildUrl(tableId: string, params?: AirtableParams, offset?: string): string {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const url = new URL(`${BASE_URL}/${baseId}/${tableId}`);

  if (params?.filterByFormula) {
    url.searchParams.set("filterByFormula", params.filterByFormula);
  }
  if (params?.maxRecords) {
    url.searchParams.set("maxRecords", String(params.maxRecords));
  }
  if (params?.view) {
    url.searchParams.set("view", params.view);
  }
  if (params?.sort) {
    params.sort.forEach((s, i) => {
      url.searchParams.set(`sort[${i}][field]`, s.field);
      url.searchParams.set(`sort[${i}][direction]`, s.direction ?? "asc");
    });
  }
  if (params?.fields) {
    params.fields.forEach((f, i) => {
      url.searchParams.set(`fields[${i}]`, f);
    });
  }
  if (offset) {
    url.searchParams.set("offset", offset);
  }
  return url.toString();
}

export async function airtableFetch<T>(
  tableId: string,
  params?: AirtableParams
): Promise<T[]> {
  const records: T[] = [];
  let offset: string | undefined;

  do {
    const res = await fetch(buildUrl(tableId, params, offset), {
      headers: getHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable ${res.status}: ${err}`);
    }
    const data = await res.json();
    records.push(...(data.records as T[]));
    offset = data.offset;
  } while (offset);

  return records;
}

export async function airtableCreate(
  tableId: string,
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const res = await fetch(`${BASE_URL}/${baseId}/${tableId}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable create error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return { id: data.id };
}

export async function airtablePatch(
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const res = await fetch(`${BASE_URL}/${baseId}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable patch error ${res.status}: ${err}`);
  }
}

// ---------------------------------------------------------------------------
// Content Airtable (WordPress Automation base — separate API key + base ID)
// ---------------------------------------------------------------------------

function getContentHeaders() {
  if (!process.env.CONTENT_AIRTABLE_API_KEY) {
    throw new Error("CONTENT_AIRTABLE_API_KEY is not set");
  }
  return {
    Authorization: `Bearer ${process.env.CONTENT_AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function contentAirtableFetch<T>(
  tableId: string,
  params?: AirtableParams
): Promise<T[]> {
  const records: T[] = [];
  let offset: string | undefined;
  const baseId = process.env.CONTENT_AIRTABLE_BASE_ID;

  do {
    const url = new URL(`${BASE_URL}/${baseId}/${tableId}`);
    if (params?.filterByFormula) url.searchParams.set("filterByFormula", params.filterByFormula);
    if (params?.maxRecords) url.searchParams.set("maxRecords", String(params.maxRecords));
    if (params?.view) url.searchParams.set("view", params.view);
    if (params?.sort) {
      params.sort.forEach((s, i) => {
        url.searchParams.set(`sort[${i}][field]`, s.field);
        url.searchParams.set(`sort[${i}][direction]`, s.direction ?? "asc");
      });
    }
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: getContentHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Content Airtable fetch error ${res.status}: ${err}`);
    }
    const data = await res.json();
    records.push(...(data.records as T[]));
    offset = data.offset;
  } while (offset);

  return records;
}

export async function contentAirtableCreate(
  tableId: string,
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  const baseId = process.env.CONTENT_AIRTABLE_BASE_ID;
  const res = await fetch(`${BASE_URL}/${baseId}/${tableId}`, {
    method: "POST",
    headers: getContentHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Content Airtable create error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return { id: data.id };
}

export async function contentAirtablePatch(
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const baseId = process.env.CONTENT_AIRTABLE_BASE_ID;
  const res = await fetch(`${BASE_URL}/${baseId}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: getContentHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Content Airtable patch error ${res.status}: ${err}`);
  }
}
