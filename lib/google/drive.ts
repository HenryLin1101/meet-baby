import { refreshAccessToken } from "@/lib/google/oauth";

type DriveFileMetadata = {
  id: string;
  name?: string;
  mimeType?: string;
};

function driveApiUrl(path: string): string {
  return `https://www.googleapis.com/drive/v3${path}`;
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
    const message =
      typeof (json as { error?: unknown } | null)?.error === "string"
        ? String((json as { error?: string }).error)
        : `Google API error (${response.status})`;
    throw new Error(message);
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
    throw new Error(`Google API error (${response.status})`);
  }
  return await response.text();
}

export async function exportGoogleDocAsPlainText(input: {
  fileId: string;
  refreshToken: string;
}): Promise<{ title: string; text: string }> {
  const { accessToken } = await refreshAccessToken(input.refreshToken);

  const metadata = await googleFetchJson<DriveFileMetadata>(
    driveApiUrl(`/files/${encodeURIComponent(input.fileId)}?fields=id,name,mimeType`),
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
        )}`
      ),
      accessToken
    );
    return { title: name, text: text.trim() };
  }

  // For other file types, try downloading as plain text when possible.
  const content = await googleFetchText(
    driveApiUrl(`/files/${encodeURIComponent(input.fileId)}?alt=media`),
    accessToken
  );
  return { title: name, text: content.trim() };
}

