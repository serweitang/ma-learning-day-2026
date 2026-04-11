/**
 * Google Drive folder setup script
 *
 * Creates the MA Memos folder in the service account's My Drive (if it doesn't
 * already exist), then grants Editor access to one or more email addresses.
 *
 * Usage:
 *   node scripts/setup-drive.mjs email1@example.com email2@example.com
 *
 * The script reads credentials from .env.local and prints the folder ID.
 * Paste the folder ID into GOOGLE_DRIVE_FOLDER_ID in .env.local.
 *
 * Safe to rerun — it reuses the existing folder and skips emails already shared.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dependency needed)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

let envContents;
try {
  envContents = readFileSync(envPath, "utf-8");
} catch {
  console.error("❌  Could not read .env.local — make sure it exists in the project root.");
  process.exit(1);
}

function parseEnv(contents) {
  const env = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = parseEnv(envContents);

const SERVICE_ACCOUNT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const EXISTING_FOLDER_ID = env.GOOGLE_DRIVE_FOLDER_ID || null;
const FOLDER_NAME = "MA Memos";

if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
  console.error("❌  GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY missing from .env.local");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Email addresses from CLI args
// ---------------------------------------------------------------------------
const emails = process.argv.slice(2).filter((a) => a.includes("@"));

if (emails.length === 0) {
  console.error("❌  Please provide at least one email address as an argument.");
  console.error("    Example: node scripts/setup-drive.mjs you@example.com");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Drive client
// ---------------------------------------------------------------------------
const auth = new google.auth.GoogleAuth({
  credentials: { client_email: SERVICE_ACCOUNT_EMAIL, private_key: PRIVATE_KEY },
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });

// ---------------------------------------------------------------------------
// Find or create the folder
// ---------------------------------------------------------------------------
async function getOrCreateFolder() {
  // If a folder ID is already configured, verify it still exists
  if (EXISTING_FOLDER_ID) {
    try {
      await drive.files.get({ fileId: EXISTING_FOLDER_ID, fields: "id, name" });
      console.log(`✅  Using existing folder: ${EXISTING_FOLDER_ID}`);
      return EXISTING_FOLDER_ID;
    } catch {
      console.warn(`⚠️   Configured folder ID not found — creating a new one.`);
    }
  }

  // Search for an existing folder by name in My Drive
  const list = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
  });

  if (list.data.files?.length) {
    const folder = list.data.files[0];
    console.log(`✅  Found existing folder "${folder.name}": ${folder.id}`);
    return folder.id;
  }

  // Create a new folder
  const created = await drive.files.create({
    requestBody: {
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });
  console.log(`✅  Created new folder "${FOLDER_NAME}": ${created.data.id}`);
  return created.data.id;
}

// ---------------------------------------------------------------------------
// Share folder with an email (skip if already shared)
// ---------------------------------------------------------------------------
async function shareWithEmail(folderId, email) {
  // Check existing permissions
  const perms = await drive.permissions.list({
    fileId: folderId,
    fields: "permissions(id, emailAddress, role)",
  });

  const existing = perms.data.permissions?.find(
    (p) => p.emailAddress?.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    console.log(`  ↳ ${email} — already has "${existing.role}" access, skipping.`);
    return;
  }

  await drive.permissions.create({
    fileId: folderId,
    sendNotificationEmail: false,
    requestBody: { role: "writer", type: "user", emailAddress: email },
  });
  console.log(`  ↳ ${email} — granted Editor access.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  try {
    const folderId = await getOrCreateFolder();

    console.log("\nSharing folder with:");
    for (const email of emails) {
      await shareWithEmail(folderId, email);
    }

    console.log("\n----------------------------------------");
    console.log(`Folder ID: ${folderId}`);
    console.log("----------------------------------------");
    if (!EXISTING_FOLDER_ID || EXISTING_FOLDER_ID !== folderId) {
      console.log("\n👉  Add this to your .env.local:");
      console.log(`    GOOGLE_DRIVE_FOLDER_ID=${folderId}`);
    }
    console.log("\nDone.");
  } catch (err) {
    console.error("❌  Error:", err.message ?? err);
    process.exit(1);
  }
})();
