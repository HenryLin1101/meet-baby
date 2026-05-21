import { refreshAccessToken } from "@/lib/google/oauth";

export type TactiqTranscriptFile = {
  fileId: string;
  name: string;
  webViewLink: string;
  modifiedTime: string;
  createdTime: string;
};

type DriveFileListResponse = {
  files?: Array<{
    id?: string;
    name?: string;
    webViewLink?: string;
    modifiedTime?: string;
    createdTime?: string;
  }>;
};

type DriveFolderListResponse = {
  files?: Array<{ id?: string }>;
};

const DEFAULT_EXCLUDED_FILE_NAMES = [
  "會議詳細資料",
  "Meeting Details",
] as const;

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

/** When set, only files whose name contains this substring are listed. */
export function getTactiqTranscriptNameHint(): string | null {
  const hint = process.env.TACTIQ_TRANSCRIPT_FILE_NAME?.trim();
  return hint || null;
}

export function getTactiqExcludedFileNames(): string[] {
  const fromEnv = process.env.TACTIQ_EXCLUDED_FILE_NAMES?.trim();
  if (!fromEnv) return [...DEFAULT_EXCLUDED_FILE_NAMES];
  return fromEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isExcludedTactiqMetadataFile(fileName: string): boolean {
  const normalized = normalizeTitle(fileName);
  return getTactiqExcludedFileNames().some(
    (excluded) => normalizeTitle(excluded) === normalized
  );
}

export function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function scoreTranscriptTitleMatch(
  fileName: string,
  eventTitle: string
): number {
  const file = normalizeTitle(fileName);
  const event = normalizeTitle(eventTitle);
  if (!file || !event) return 0;
  if (file === event) return 100;
  if (file.includes(event) || event.includes(file)) return 80;
  return 0;
}

function isWithinTimeWindow(
  isoTime: string,
  windowStart: Date,
  windowEnd: Date
): boolean {
  const t = new Date(isoTime).getTime();
  if (Number.isNaN(t)) return false;
  return t > windowStart.getTime() && t < windowEnd.getTime();
}

function fileMatchesTimeWindow(
  file: { modifiedTime: string; createdTime: string },
  windowStart: Date,
  windowEnd: Date
): boolean {
  return (
    isWithinTimeWindow(file.modifiedTime, windowStart, windowEnd) ||
    isWithinTimeWindow(file.createdTime, windowStart, windowEnd)
  );
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

/** Lists Google Docs in the Tactiq folder within the time window (all names unless env hint set). */
export async function listTactiqTranscripts(input: {
  refreshToken: string;
  windowStart: Date;
  windowEnd: Date;
  folderName?: string;
  transcriptNameHint?: string | null;
}): Promise<TactiqTranscriptFile[]> {
  const { accessToken } = await refreshAccessToken(input.refreshToken);
  const folderName = input.folderName ?? getTactiqFolderName();
  const nameHint =
    input.transcriptNameHint !== undefined
      ? input.transcriptNameHint
      : getTactiqTranscriptNameHint();

  const folderId = await findFolderIdByName(accessToken, folderName);
  if (!folderId) {
    return [];
  }

  const start = toDriveRfc3339(input.windowStart);
  const end = toDriveRfc3339(input.windowEnd);

  const timeClause = [
    "(",
    `(modifiedTime > '${start}' and modifiedTime < '${end}')`,
    " or ",
    `(createdTime > '${start}' and createdTime < '${end}')`,
    ")",
  ].join("");

  const qParts = [
    `'${folderId}' in parents`,
    "mimeType='application/vnd.google-apps.document'",
    "trashed=false",
    timeClause,
  ];

  if (nameHint) {
    qParts.push(`name contains '${escapeDriveQueryValue(nameHint)}'`);
  }

  const q = qParts.join(" and ");

  const url = `${driveApiUrl("/files")}?${new URLSearchParams({
    q,
    orderBy: "modifiedTime desc",
    pageSize: "50",
    fields: "files(id,name,webViewLink,modifiedTime,createdTime)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  }).toString()}`;

  const data = await googleFetchJson<DriveFileListResponse>(url, accessToken);
  const files: TactiqTranscriptFile[] = [];

  for (const file of data.files ?? []) {
    const fileId = file.id?.trim();
    if (!fileId) continue;
    const name = file.name?.trim();
    if (!name || isExcludedTactiqMetadataFile(name)) continue;

    const modifiedTime = file.modifiedTime?.trim();
    const createdTime = file.createdTime?.trim() ?? modifiedTime;
    if (!modifiedTime || !createdTime) continue;

    const entry: TactiqTranscriptFile = {
      fileId,
      name,
      webViewLink:
        file.webViewLink?.trim() ||
        `https://docs.google.com/document/d/${fileId}/edit`,
      modifiedTime,
      createdTime,
    };

    if (!fileMatchesTimeWindow(entry, input.windowStart, input.windowEnd)) {
      continue;
    }

    files.push(entry);
  }

  return files;
}

export type PickTranscriptInput = {
  excludedFileIds: ReadonlySet<string>;
  referenceTime: Date;
  /** When multiple files match, prefer the one closest to this event title. */
  eventTitle?: string | null;
};

export function pickBestTranscript(
  candidates: TactiqTranscriptFile[],
  input: PickTranscriptInput
): TactiqTranscriptFile | null {
  const eligible = candidates.filter(
    (c) =>
      !input.excludedFileIds.has(c.fileId) &&
      !isExcludedTactiqMetadataFile(c.name)
  );
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];

  const eventTitle = input.eventTitle?.trim();
  const ref = input.referenceTime.getTime();

  if (eventTitle) {
    const scored = eligible.map((file) => ({
      file,
      titleScore: scoreTranscriptTitleMatch(file.name, eventTitle),
      timeDistance: Math.abs(new Date(file.modifiedTime).getTime() - ref),
    }));

    const maxTitleScore = Math.max(...scored.map((s) => s.titleScore));
    const pool =
      maxTitleScore > 0
        ? scored.filter((s) => s.titleScore === maxTitleScore)
        : scored;

    pool.sort((a, b) => {
      if (b.titleScore !== a.titleScore) return b.titleScore - a.titleScore;
      return a.timeDistance - b.timeDistance;
    });
    return pool[0]?.file ?? null;
  }

  let best = eligible[0];
  let bestDistance = Math.abs(new Date(best.modifiedTime).getTime() - ref);
  for (const file of eligible.slice(1)) {
    const distance = Math.abs(new Date(file.modifiedTime).getTime() - ref);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = file;
    }
  }
  return best;
}
