const BASE_URL = "https://api.airtable.com/v0";

function getHeaders() {
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error("AIRTABLE_API_KEY is not set");
  }
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function airtableFetch<T>(
  tableId: string,
  params?: Record<string, string>
): Promise<T[]> {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const url = new URL(`${BASE_URL}/${baseId}/${tableId}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const records: T[] = [];
  let offset: string | undefined;

  do {
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: getHeaders(),
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable error ${res.status}: ${err}`);
    }
    const data = await res.json();
    records.push(...(data.records as T[]));
    offset = data.offset;
  } while (offset);

  return records;
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
