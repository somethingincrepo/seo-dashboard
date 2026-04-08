import type Anthropic from "@anthropic-ai/sdk";
import { getGoogleAccessToken } from "./google-auth";

const DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents";

// ---------------------------------------------------------------------------
// drive_upload_html_as_pdf
// Strategy: create a Google Doc from HTML (Drive import), export as PDF,
// upload the PDF to the target folder, delete the intermediate Doc.
// This avoids needing a PDF library in the Next.js environment.
// ---------------------------------------------------------------------------

export const driveUploadHtmlAsPdfDefinition: Anthropic.Messages.Tool = {
  name: "drive_upload_html_as_pdf",
  description:
    "Convert an HTML string to a PDF and upload it to a Google Drive folder. " +
    "Internally: imports HTML as a Google Doc, exports it as PDF, uploads to the folder, " +
    "then deletes the intermediate Doc. Returns the web view link of the uploaded PDF. " +
    "Use for monthly report PDF generation.",
  input_schema: {
    type: "object" as const,
    properties: {
      html: {
        type: "string",
        description: "Full HTML document string to convert to PDF",
      },
      file_name: {
        type: "string",
        description: "Name for the uploaded PDF file (without .pdf extension)",
      },
      folder_id: {
        type: "string",
        description: "Google Drive folder ID to upload the PDF into",
      },
      share_anyone: {
        type: "boolean",
        description:
          "If true, set the file as publicly viewable by anyone with the link (default: false)",
      },
    },
    required: ["html", "file_name", "folder_id"],
  },
};

type DriveUploadInput = {
  html: string;
  file_name: string;
  folder_id: string;
  share_anyone?: boolean;
};

export async function executeDriveUploadHtmlAsPdf(
  input: DriveUploadInput
): Promise<{ file_id: string; web_view_link: string }> {
  const { html, file_name, folder_id, share_anyone = false } = input;
  const token = await getGoogleAccessToken(DRIVE_SCOPE);

  // Step 1: Import HTML as a Google Doc
  const docMeta = JSON.stringify({ name: `__tmp_${file_name}` });
  const boundary = "---boundary_report_upload";
  const importBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${docMeta}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html\r\n\r\n` +
    `${html}\r\n` +
    `--${boundary}--`;

  const importRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&convert=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: importBody,
    }
  );

  if (!importRes.ok) {
    throw new Error(`Drive HTML import error ${importRes.status}: ${await importRes.text()}`);
  }

  const importData = await importRes.json();
  const docId = importData.id as string;

  try {
    // Step 2: Export the Google Doc as PDF bytes
    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=application/pdf`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!exportRes.ok) {
      throw new Error(`Drive PDF export error ${exportRes.status}: ${await exportRes.text()}`);
    }

    const pdfBytes = await exportRes.arrayBuffer();

    // Step 3: Upload PDF to the target folder
    const pdfMeta = JSON.stringify({
      name: `${file_name}.pdf`,
      parents: [folder_id],
      mimeType: "application/pdf",
    });

    const uploadBoundary = "---boundary_pdf_upload";
    const uploadBody =
      `--${uploadBoundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${pdfMeta}\r\n` +
      `--${uploadBoundary}\r\n` +
      `Content-Type: application/pdf\r\n\r\n`;

    // Combine the multipart body with the binary PDF
    const pdfPreamble = Buffer.from(uploadBody);
    const pdfSuffix = Buffer.from(`\r\n--${uploadBoundary}--`);
    const pdfBuffer = Buffer.from(pdfBytes);
    const fullBody = Buffer.concat([pdfPreamble, pdfBuffer, pdfSuffix]);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${uploadBoundary}`,
          "Content-Length": String(fullBody.length),
        },
        body: fullBody,
      }
    );

    if (!uploadRes.ok) {
      throw new Error(`Drive PDF upload error ${uploadRes.status}: ${await uploadRes.text()}`);
    }

    const uploadData = await uploadRes.json();
    const file_id = uploadData.id as string;
    let web_view_link = uploadData.webViewLink as string;

    // Step 4: Optionally share
    if (share_anyone) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });

      // Fetch the shareable link
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file_id}?fields=webViewLink`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        web_view_link = (meta.webViewLink as string) ?? web_view_link;
      }
    }

    return { file_id, web_view_link };
  } finally {
    // Step 5: Always delete the intermediate Google Doc
    await fetch(`https://www.googleapis.com/drive/v3/files/${docId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {
      // Non-fatal — orphaned doc is harmless
    });
  }
}

// ---------------------------------------------------------------------------
// drive_list_files — list files in a folder (useful for finding report folders)
// ---------------------------------------------------------------------------

export const driveListFilesDefinition: Anthropic.Messages.Tool = {
  name: "drive_list_files",
  description:
    "List files in a Google Drive folder. Returns file names, IDs, and MIME types. " +
    "Use to verify a folder exists or find existing report files.",
  input_schema: {
    type: "object" as const,
    properties: {
      folder_id: {
        type: "string",
        description: "Google Drive folder ID to list",
      },
      max_results: {
        type: "number",
        description: "Max files to return (default: 50)",
      },
    },
    required: ["folder_id"],
  },
};

type DriveListInput = {
  folder_id: string;
  max_results?: number;
};

type DriveFile = {
  id: string;
  name: string;
  mime_type: string;
  web_view_link: string;
};

export async function executeDriveListFiles(
  input: DriveListInput
): Promise<{ files: DriveFile[] }> {
  const { folder_id, max_results = 50 } = input;
  const token = await getGoogleAccessToken(DRIVE_SCOPE);

  const params = new URLSearchParams({
    q: `'${folder_id}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,webViewLink)",
    pageSize: String(Math.min(max_results, 1000)),
    orderBy: "createdTime desc",
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(`drive_list_files error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const files: DriveFile[] = ((data.files ?? []) as Record<string, unknown>[]).map((f) => ({
    id: (f.id as string) ?? "",
    name: (f.name as string) ?? "",
    mime_type: (f.mimeType as string) ?? "",
    web_view_link: (f.webViewLink as string) ?? "",
  }));

  return { files };
}
