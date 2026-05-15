import { getServiceAccountAccessToken } from "@/lib/google/serviceAccount";

export type DriveFolder = {
  id: string;
  webViewLink: string;
};

export async function createDriveFolder(input: {
  name: string;
  parentId?: string;
}): Promise<DriveFolder> {
  const accessToken = await getServiceAccountAccessToken();

  const metadata: Record<string, unknown> = {
    name: input.name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (input.parentId) {
    metadata.parents = [input.parentId];
  }

  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
      cache: "no-store",
    }
  );

  const json = (await response.json()) as {
    id?: string;
    webViewLink?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(
      `Drive create folder error: ${json.error?.message ?? response.status}`
    );
  }
  if (!json.id || !json.webViewLink) {
    throw new Error("Drive API returned incomplete folder data.");
  }
  return { id: json.id, webViewLink: json.webViewLink };
}

export async function setDriveFolderPermission(input: {
  folderId: string;
  role: "reader" | "writer";
}): Promise<void> {
  const accessToken = await getServiceAccountAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.folderId)}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "anyone", role: input.role }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const json = (await response
      .json()
      .catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(
      `Drive set permission error: ${json?.error?.message ?? response.status}`
    );
  }
}

export function formatMeetingFolderName(title: string, startsAt: string): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(startsAt))
    .replace(/-/g, "");
  return `${date}_${title}`;
}
