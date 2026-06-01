import { getServiceAccountAccessToken } from "@/lib/google/serviceAccount";

export type DriveFileInfo = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
};

const SUPPORTED_MIME_TYPES = new Set([
  "application/vnd.google-apps.document",
  "application/pdf",
]);

export async function listDriveFolderFiles(folderId: string): Promise<DriveFileInfo[]> {
  const accessToken = await getServiceAccountAccessToken();
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    pageSize: "100",
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );

  const json = (await res.json()) as {
    files?: DriveFileInfo[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? "Drive list files failed");

  return (json.files ?? []).filter((f) => SUPPORTED_MIME_TYPES.has(f.mimeType));
}

export async function readDriveFileAsText(file: DriveFileInfo): Promise<string | null> {
  const accessToken = await getServiceAccountAccessToken();

  if (file.mimeType === "application/vnd.google-apps.document") {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text%2Fplain&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    return (await res.text()).trim() || null;
  }

  if (file.mimeType === "application/pdf") {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return await extractPdfTextWithGemini(base64);
  }

  return null;
}

async function extractPdfTextWithGemini(base64: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY 尚未設定。");
  const model = process.env.CHAT_MODEL?.trim() || "gemini-2.0-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { inline_data: { mime_type: "application/pdf", data: base64 } },
            { text: "請將這份 PDF 的所有文字內容完整提取出來，保留原始結構，不要添加任何分析或摘要。" },
          ],
        }],
      }),
      cache: "no-store",
    }
  );

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? "Gemini PDF extraction failed");

  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}
