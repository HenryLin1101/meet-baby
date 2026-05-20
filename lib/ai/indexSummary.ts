import { getSupabaseAdmin } from "@/lib/db/client";
import { embedText } from "@/lib/ai/embeddings";
import type { MeetingSummary } from "@/lib/ai/openai";

type DocumentChunkInsert = {
  summary_id: number;
  group_id: number;
  content: string;
  chunk_type: string;
  embedding: string;
  metadata: Record<string, unknown>;
};

function chunkText(text: string, size = 800, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks.filter((c) => c.trim().length > 0);
}

export async function indexSummary(input: {
  summaryId: number;
  groupId: number;
  meetingTitle: string;
  summaryJson: MeetingSummary;
  summaryText: string;
  transcriptText?: string | null;
}): Promise<void> {
  const { summaryId, groupId, meetingTitle, summaryJson, summaryText, transcriptText } = input;

  const baseMetadata = { summaryId, meetingTitle };


  const rawChunks: { content: string; chunk_type: string; metadata: Record<string, unknown> }[] = [];

  // 整份摘要文字
  if (summaryText.trim()) {
    rawChunks.push({
      content: summaryText.trim(),
      chunk_type: "summary",
      metadata: baseMetadata,
    });
  }

  // 一條 action item 一個 chunk
  for (const action of summaryJson.actionItems) {
    const content = [
      `待辦事項：${action.item}`,
      action.owner ? `負責人：${action.owner}` : null,
      action.due ? `截止日：${action.due}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    rawChunks.push({
      content,
      chunk_type: "action_item",
      metadata: { ...baseMetadata, owner: action.owner, due: action.due },
    });
  }

  // 3. 逐字稿切段（預設每段 800 字，overlap 200 字）
  if (transcriptText?.trim()) {
    const segments = chunkText(transcriptText.trim());
    segments.forEach((segment, idx) => {
      rawChunks.push({
        content: segment,
        chunk_type: "transcript",
        metadata: { ...baseMetadata, chunkIndex: idx },
      });
    });
  }

  if (rawChunks.length === 0) return;

  // 依序 embed 並組成 insert rows
  const rows: DocumentChunkInsert[] = [];
  for (const chunk of rawChunks) {
    const vector = await embedText(chunk.content);
    rows.push({
      summary_id: summaryId,
      group_id: groupId,
      content: chunk.content,
      chunk_type: chunk.chunk_type,
      // pgvector 接受 "[x,y,z,...]" 字串格式
      embedding: `[${vector.join(",")}]`,
      metadata: chunk.metadata,
    });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("document_chunks").insert(rows);
  if (error) {
    throw new Error(`儲存 document_chunks 失敗：${error.message}`);
  }
}
