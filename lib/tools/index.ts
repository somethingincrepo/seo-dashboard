import { httpFetchDefinition, executeHttpFetch } from "./http-fetch";
import {
  airtableFetchDefinition,
  airtableCreateDefinition,
  airtablePatchDefinition,
  executeAirtableFetch,
  executeAirtableCreate,
  executeAirtablePatch,
} from "./airtable";
import {
  dataforSeoSerpDefinition,
  dataforSeoKeywordInfoDefinition,
  dataforSeoRelatedKeywordsDefinition,
  executeDataforSeoSerp,
  executeDataforSeoKeywordInfo,
  executeDataforSeoRelatedKeywords,
} from "./dataforseo";
import {
  gscQueryDefinition,
  executeGscQuery,
} from "./gsc";
import {
  sheetsReadDefinition,
  sheetsBatchUpdateDefinition,
  executeSheetsRead,
  executeSheetsBatchUpdate,
} from "./google-sheets";
import {
  driveUploadHtmlAsPdfDefinition,
  driveListFilesDefinition,
  driveCreateFolderDefinition,
  executeDriveUploadHtmlAsPdf,
  executeDriveListFiles,
  executeDriveCreateFolder,
} from "./google-drive";
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
  dataforseo_serp: {
    definition: dataforSeoSerpDefinition,
    execute: (input) => executeDataforSeoSerp(input as Parameters<typeof executeDataforSeoSerp>[0]),
  },
  dataforseo_keyword_info: {
    definition: dataforSeoKeywordInfoDefinition,
    execute: (input) => executeDataforSeoKeywordInfo(input as Parameters<typeof executeDataforSeoKeywordInfo>[0]),
  },
  dataforseo_related_keywords: {
    definition: dataforSeoRelatedKeywordsDefinition,
    execute: (input) => executeDataforSeoRelatedKeywords(input as Parameters<typeof executeDataforSeoRelatedKeywords>[0]),
  },
  gsc_query: {
    definition: gscQueryDefinition,
    execute: (input) => executeGscQuery(input as Parameters<typeof executeGscQuery>[0]),
  },
  sheets_read: {
    definition: sheetsReadDefinition,
    execute: (input) => executeSheetsRead(input as Parameters<typeof executeSheetsRead>[0]),
  },
  sheets_batch_update: {
    definition: sheetsBatchUpdateDefinition,
    execute: (input) => executeSheetsBatchUpdate(input as Parameters<typeof executeSheetsBatchUpdate>[0]),
  },
  drive_upload_html_as_pdf: {
    definition: driveUploadHtmlAsPdfDefinition,
    execute: (input) => executeDriveUploadHtmlAsPdf(input as Parameters<typeof executeDriveUploadHtmlAsPdf>[0]),
  },
  drive_list_files: {
    definition: driveListFilesDefinition,
    execute: (input) => executeDriveListFiles(input as Parameters<typeof executeDriveListFiles>[0]),
  },
  drive_create_folder: {
    definition: driveCreateFolderDefinition,
    execute: (input) => executeDriveCreateFolder(input as Parameters<typeof executeDriveCreateFolder>[0]),
  },
};
