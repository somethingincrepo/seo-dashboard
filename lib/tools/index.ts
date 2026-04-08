import { httpFetchDefinition, executeHttpFetch } from "./http-fetch";
import {
  airtableFetchDefinition,
  airtableCreateDefinition,
  airtablePatchDefinition,
  executeAirtableFetch,
  executeAirtableCreate,
  executeAirtablePatch,
} from "./airtable";
import type Anthropic from "@anthropic-ai/sdk";

export type ToolImpl = {
  definition: Anthropic.Messages.Tool;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

export const TOOL_REGISTRY: Record<string, ToolImpl> = {
  http_fetch: {
    definition: httpFetchDefinition,
    execute: (input) => executeHttpFetch(input as Parameters<typeof executeHttpFetch>[0]),
  },
  airtable_fetch: {
    definition: airtableFetchDefinition,
    execute: (input) => executeAirtableFetch(input as Parameters<typeof executeAirtableFetch>[0]),
  },
  airtable_create: {
    definition: airtableCreateDefinition,
    execute: (input) => executeAirtableCreate(input as Parameters<typeof executeAirtableCreate>[0]),
  },
  airtable_patch: {
    definition: airtablePatchDefinition,
    execute: (input) => executeAirtablePatch(input as Parameters<typeof executeAirtablePatch>[0]),
  },
};
