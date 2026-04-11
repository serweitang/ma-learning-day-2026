import { google } from "googleapis";
import { Readable } from "stream";

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

/** Google Drive embed URL for inline PDF viewing in an iframe. */
export function driveEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Uploads a PDF for the given maId to the service account's My Drive.
 * Replaces any existing file with the same name.
 * Returns the Drive file ID.
 */
export async function uploadToDrive(maId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const drive = getDriveClient();

  // Delete any existing file for this MA first
  await deleteDriveFileByMaId(maId);

  const requestBody: Record<string, unknown> = {
    name: `${maId}.pdf`,
    mimeType,
  };

  // Use a folder if configured, otherwise upload to My Drive root
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (folderId) {
    requestBody.parents = [folderId];
  }

  const res = await drive.files.create({
    requestBody,
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
  });

  const fileId = res.data.id!;

  // Make file readable by anyone with the link
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return fileId;
}

/**
 * Finds and deletes any Drive file named `{maId}.pdf` in the service account's My Drive.
 */
export async function deleteDriveFileByMaId(maId: string): Promise<void> {
  const drive = getDriveClient();

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const q = folderId
    ? `name='${maId}.pdf' and '${folderId}' in parents and trashed=false`
    : `name='${maId}.pdf' and trashed=false`;

  const res = await drive.files.list({ q, fields: "files(id)" });

  for (const file of res.data.files ?? []) {
    try {
      await drive.files.delete({ fileId: file.id! });
    } catch {
      // ignore — file may already be gone
    }
  }
}
