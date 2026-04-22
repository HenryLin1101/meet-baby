import { refreshAccessToken } from "@/lib/google/oauth";

type DriveFileMetadata = {
  id: string;
  name?: string;
  mimeType?: string;
};

function driveApiUrl(path: string): string {
  return `https://www.googleapis.com/drive/v3${path}`;
}

type GoogleApiErrorPayload =
  | {
      error?: {
        message?: string;
        status?: string;
        code?: number;
        errors?: Array<{ message?: string; reason?: string }>;
      };
    }
  | { error?: string };

function formatGoogleApiError(
  status: number,
  payload: unknown
): string {
  const p = payload as GoogleApiErrorPayload | null;
  const messageFromString =
    typeof (p as { error?: unknown } | null)?.error === "string"
      ? String((p as { error?: string }).error)
      : null;
  if (messageFromString) {
    return `Google API error (${status}): ${messageFromString}`;
  }

  const nestedUnknown = (p as { error?: unknown } | null)?.error as unknown;
  if (typeof nestedUnknown === "string") {
    return `Google API error (${status}): ${nestedUnknown}`;
  }

  const nested = nestedUnknown as
    | {
        message?: unknown;
        status?: unknown;
        errors?: unknown;
      }
    | null;

  const message =
    typeof nested?.message === "string" ? String(nested.message) : null;
  const statusText =
    typeof nested?.status === "string" ? String(nested.status) : null;
  const reason =
    Array.isArray(nested?.errors) &&
    typeof (nested.errors[0] as { reason?: unknown } | null)?.reason === "string"
      ? String((nested.errors[0] as { reason: string }).reason)
      : null;

  const parts = [message, reason ? `reason=${reason}` : null, statusText ? `status=${statusText}` : null]
    .filter(Boolean)
    .join(" / ");
  return parts
    ? `Google API error (${status}): ${parts}`
    : `Google API error (${status})`;
}

async function googleFetchJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    throw new Error(formatGoogleApiError(response.status, json));
  }
  if (!json) {
    throw new Error("Google API returned empty JSON.");
  }
  return json;
}

async function googleFetchText(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let payload: unknown = null;
    try {
      payload = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      payload = null;
    }
    throw new Error(
      payload ? formatGoogleApiError(response.status, payload) : `Google API error (${response.status})`
    );
  }
  return await response.text();
}

export async function exportGoogleDocAsPlainText(input: {
  fileId: string;
  refreshToken: string;
}): Promise<{ title: string; text: string }> {
  const { accessToken } = await refreshAccessToken(input.refreshToken);

  const metadata = await googleFetchJson<DriveFileMetadata>(
    driveApiUrl(
      `/files/${encodeURIComponent(
        input.fileId
      )}?fields=id,name,mimeType&supportsAllDrives=true`
    ),
    accessToken
  );
  const name = metadata.name?.trim() || "Google Doc";
  const mimeType = metadata.mimeType?.trim() || "";

  // Google Docs mimeType is application/vnd.google-apps.document
  if (mimeType === "application/vnd.google-apps.document") {
    const text = await googleFetchText(
      driveApiUrl(
        `/files/${encodeURIComponent(input.fileId)}/export?mimeType=${encodeURIComponent(
          "text/plain"
        )}&supportsAllDrives=true`
      ),
      accessToken
    );
    return { title: name, text: text.trim() };
  }

  // For other file types, try downloading as plain text when possible.
  const content = await googleFetchText(
    driveApiUrl(
      `/files/${encodeURIComponent(input.fileId)}?alt=media&supportsAllDrives=true`
    ),
    accessToken
  );
  return { title: name, text: content.trim() };
}

