export type ParsedDriveLink = {
  fileId: string;
  normalizedUrl: string;
};

function extractFileIdFromUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  // docs.google.com/document/d/<fileId>/...
  if (host.endsWith("docs.google.com")) {
    const match = path.match(/\/d\/([a-zA-Z0-9_-]{10,})\b/);
    if (match?.[1]) return match[1];
  }

  // drive.google.com/file/d/<fileId>/view
  if (host.endsWith("drive.google.com")) {
    const fileMatch = path.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})\b/);
    if (fileMatch?.[1]) return fileMatch[1];

    // drive.google.com/open?id=<fileId>
    const id = url.searchParams.get("id")?.trim();
    if (id) return id;
  }

  // Generic: ?id=<fileId>
  const genericId = url.searchParams.get("id")?.trim();
  if (genericId) return genericId;

  return null;
}

export function parseGoogleDriveLink(raw: string): ParsedDriveLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const fileId = extractFileIdFromUrl(url);
  if (!fileId) return null;

  return { fileId, normalizedUrl: url.toString() };
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/\S+/i);
  if (!match?.[0]) return null;
  // trim trailing punctuation often copied with the link
  return match[0].replace(/[)\],.]+$/g, "");
}

