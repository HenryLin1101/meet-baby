import { getSupabaseAdmin } from "@/lib/db/client";
import { embedText } from "@/lib/ai/embeddings";
import type { DriveFileInfo } from "@/lib/google/driveFiles";

function chunkText(text: string, size = 800, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks.filter((c) => c.trim().length > 0);
}

export async function indexDriveFile(input: {
  groupId: number;
  file: DriveFileInfo;
  text: string;
}): Promise<number> {
  const { groupId, file, text } = input;

  if (!text.trim()) return 0;

  const segments = chunkText(text.trim());
  if (segments.length === 0) return 0;

  const supabase = getSupabaseAdmin();

  // 刪除舊的 chunks（重新 index 時）
  await supabase
    .from("document_chunks")
    .delete()
    .eq("group_id", groupId)
    .eq("drive_file_id", file.id);

  const rows = [];
  for (const [idx, segment] of segments.entries()) {
    const vector = await embedText(segment);
    rows.push({
      summary_id: null,
      group_id: groupId,
      content: segment,
      chunk_type: "document",
      source_type: "drive_file",
      source_url: file.webViewLink,
      drive_file_id: file.id,
      embedding: `[${vector.join(",")}]`,
      metadata: {
        driveFileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        chunkIndex: idx,
      },
    });
    await new Promise((r) => setTimeout(r, 1000));
  }

  const { error } = await supabase.from("document_chunks").insert(rows);
  if (error) throw new Error(`儲存 document_chunks 失敗：${error.message}`);

  return rows.length;
}
