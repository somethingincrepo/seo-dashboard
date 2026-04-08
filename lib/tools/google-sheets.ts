import type Anthropic from "@anthropic-ai/sdk";
import { getGoogleAccessToken } from "./google-auth";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// ---------------------------------------------------------------------------
// sheets_read — read a range from a Google Sheet
// ---------------------------------------------------------------------------

export const sheetsReadDefinition: Anthropic.Messages.Tool = {
  name: "sheets_read",
  description:
    "Read a range of cells from a Google Sheet. Returns rows as arrays of values. " +
    "Use for reading keyword research tabs, existing data, or any structured sheet data.",
  input_schema: {
    type: "object" as const,
    properties: {
      spreadsheet_id: {
        type: "string",
        description: "Google Sheets spreadsheet ID (from the URL)",
      },
      range: {
        type: "string",
        description: "A1 notation range, e.g. 'Sheet1!A1:Z100' or 'A:Z'",
      },
    },
    required: ["spreadsheet_id", "range"],
  },
};

type SheetsReadInput = {
  spreadsheet_id: string;
  range: string;
};

export async function executeSheetsRead(
  input: SheetsReadInput
): Promise<{ rows: unknown[][] }> {
  const { spreadsheet_id, range } = input;
  const token = await getGoogleAccessToken(SHEETS_SCOPE);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    throw new Error(`sheets_read error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return { rows: (data.values ?? []) as unknown[][] };
}

// ---------------------------------------------------------------------------
// sheets_batch_update — write values to one or more ranges
// ---------------------------------------------------------------------------

export const sheetsBatchUpdateDefinition: Anthropic.Messages.Tool = {
  name: "sheets_batch_update",
  description:
    "Write values to one or more ranges in a Google Sheet (batchUpdate). " +
    "Use for writing keyword research output, updating structured tabs, or appending rows. " +
    "Overwrites existing values in the specified ranges.",
  input_schema: {
    type: "object" as const,
    properties: {
      spreadsheet_id: {
        type: "string",
        description: "Google Sheets spreadsheet ID",
      },
      updates: {
        type: "array",
        description: "Array of range/values pairs to write",
        items: {
          type: "object",
          properties: {
            range: {
              type: "string",
              description: "A1 notation range, e.g. 'Sheet1!A1'",
            },
            values: {
              type: "array",
              description: "2D array of cell values (rows × columns)",
              items: {
                type: "array",
                items: {},
              },
            },
          },
          required: ["range", "values"],
        },
      },
    },
    required: ["spreadsheet_id", "updates"],
  },
};

type SheetsBatchUpdateInput = {
  spreadsheet_id: string;
  updates: Array<{ range: string; values: unknown[][] }>;
};

export async function executeSheetsBatchUpdate(
  input: SheetsBatchUpdateInput
): Promise<{ updated_cells: number }> {
  const { spreadsheet_id, updates } = input;
  const token = await getGoogleAccessToken(SHEETS_SCOPE);

  const body = {
    valueInputOption: "USER_ENTERED",
    data: updates.map((u) => ({ range: u.range, values: u.values })),
  };

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(`sheets_batch_update error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const updated_cells = (data.totalUpdatedCells as number) ?? 0;
  return { updated_cells };
}
