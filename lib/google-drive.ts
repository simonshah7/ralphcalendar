import { google } from 'googleapis';
import { db, adminSettings } from '@/db';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  isFolder: boolean;
}

export interface DriveListResult {
  files: DriveFile[];
  nextPageToken?: string;
}

function getServiceAccountCredentials(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getDriveClient() {
  const creds = getServiceAccountCredentials();
  if (!creds) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY env var is not set. ' +
        'Set it to the JSON content of your Google service account key.',
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

export async function getDriveFolderId(): Promise<string> {
  const rows = await db.select().from(adminSettings);
  for (const r of rows) {
    if (r.key === 'google_drive_folder_id' && r.value) return r.value;
  }
  throw new Error('Google Drive folder ID is not configured. Set it in Settings.');
}

export async function listFiles(folderId: string, pageToken?: string): Promise<DriveListResult> {
  const drive = getDriveClient();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)',
    orderBy: 'folder,name',
    pageSize: 50,
    pageToken: pageToken || undefined,
  });

  const files: DriveFile[] = (response.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    size: f.size || undefined,
    modifiedTime: f.modifiedTime || undefined,
    webViewLink: f.webViewLink || undefined,
    iconLink: f.iconLink || undefined,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }));

  return {
    files,
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

export async function readFile(fileId: string): Promise<{ content: string; mimeType: string; name: string }> {
  const drive = getDriveClient();

  // Get file metadata first
  const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType' });
  const mimeType = meta.data.mimeType!;
  const name = meta.data.name!;

  // Google Docs types need export
  const exportMap: Record<string, { mime: string; label: string }> = {
    'application/vnd.google-apps.document': { mime: 'text/plain', label: 'text' },
    'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', label: 'csv' },
    'application/vnd.google-apps.presentation': { mime: 'text/plain', label: 'text' },
  };

  if (exportMap[mimeType]) {
    const response = await drive.files.export(
      { fileId, mimeType: exportMap[mimeType].mime },
      { responseType: 'text' },
    );
    return { content: response.data as string, mimeType: exportMap[mimeType].mime, name };
  }

  // For regular files (text, csv, json, etc.), download content
  const textTypes = ['text/', 'application/json', 'application/csv', 'application/xml'];
  const isText = textTypes.some((t) => mimeType.startsWith(t));

  if (isText) {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' },
    );
    return { content: response.data as string, mimeType, name };
  }

  // For binary files, return a message with the web link
  return {
    content: `Binary file: ${name} (${mimeType}). Open in Google Drive to view.`,
    mimeType,
    name,
  };
}

export async function getFileMetadata(fileId: string) {
  const drive = getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, modifiedTime, webViewLink, createdTime, description',
  });
  return response.data;
}
