import { refreshAccessToken } from "@/lib/google/oauth";

export type TactiqTranscriptFile = {
  fileId: string;
  name: string;
  webViewLink: string;
  modifiedTime: string;
};

type DriveFileListResponse = {
  files?: Array<{
    id?: string;
    name?: string;
    webViewLink?: string;
    modifiedTime?: string;
  }>;
};

type DriveFolderListResponse = {
  files?: Array<{ id?: string }>;
};

function driveApiUrl(path: string): string {
  return `https://www.googleapis.com/drive/v3${path}`;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function toDriveRfc3339(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function getTactiqFolderName(): string {
  return process.env.TACTIQ_DRIVE_FOLDER_NAME?.trim() || "Tactiq Transcription";
}

export function getTactiqTranscriptNameHint(): string {
  return process.env.TACTIQ_TRANSCRIPT_FILE_NAME?.trim() || "Meeting Transcription";
}

async function googleFetchJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message =
      json && typeof json === "object" && "error" in json
        ? JSON.stringify((json as { error?: unknown }).error)
        : `status ${response.status}`;
    throw new Error(`Google Drive API error: ${message}`);
  }
  if (!json) {
    throw new Error("Google Drive API returned empty JSON.");
  }
  return json;
}

async function findFolderIdByName(
  accessToken: string,
  folderName: string
): Promise<string | null> {
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    `name='${escapeDriveQueryValue(folderName)}'`,
  ].join(" and ");

  const url = `${driveApiUrl("/files")}?${new URLSearchParams({
    q,
    fields: "files(id)",
    pageSize: "5",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  }).toString()}`;

  const data = await googleFetchJson<DriveFolderListResponse>(url, accessToken);
  const id = data.files?.[0]?.id?.trim();
  return id || null;
}

export async function listTactiqTranscripts(input: {
  refreshToken: string;
  windowStart: Date;
  windowEnd: Date;
  folderName?: string;
  transcriptNameHint?: string;
}): Promise<TactiqTranscriptFile[]> {
  const { accessToken } = await refreshAccessToken(input.refreshToken);
  const folderName = input.folderName ?? getTactiqFolderName();
  const nameHint = input.transcriptNameHint ?? getTactiqTranscriptNameHint();

  const folderId = await findFolderIdByName(accessToken, folderName);
  if (!folderId) {
    return [];
  }

  const q = [
    `'${folderId}' in parents`,
    "mimeType='application/vnd.google-apps.document'",
    "trashed=false",
    `modifiedTime > '${toDriveRfc3339(input.windowStart)}'`,
    `modifiedTime < '${toDriveRfc3339(input.windowEnd)}'`,
    `name contains '${escapeDriveQueryValue(nameHint)}'`,
  ].join(" and ");

  const url = `${driveApiUrl("/files")}?${new URLSearchParams({
    q,
    orderBy: "modifiedTime desc",
    pageSize: "20",
    fields: "files(id,name,webViewLink,modifiedTime)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  }).toString()}`;

  const data = await googleFetchJson<DriveFileListResponse>(url, accessToken);
  const files: TactiqTranscriptFile[] = [];

  for (const file of data.files ?? []) {
    const fileId = file.id?.trim();
    if (!fileId) continue;
    const name = file.name?.trim() || "Meeting Transcription";
    const webViewLink =
      file.webViewLink?.trim() ||
      `https://docs.google.com/document/d/${fileId}/edit`;
    const modifiedTime = file.modifiedTime?.trim();
    if (!modifiedTime) continue;
    files.push({ fileId, name, webViewLink, modifiedTime });
  }

  return files;
}

export function pickBestTranscript(
  candidates: TactiqTranscriptFile[],
  excludedFileIds: ReadonlySet<string>,
  referenceTime: Date
): TactiqTranscriptFile | null {
  const eligible = candidates.filter((c) => !excludedFileIds.has(c.fileId));
  if (eligible.length === 0) return null;

  const ref = referenceTime.getTime();
  let best = eligible[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const file of eligible) {
    const modified = new Date(file.modifiedTime).getTime();
    const score = Math.abs(modified - ref);
    if (score < bestScore) {
      bestScore = score;
      best = file;
    }
  }

  return best;
}
