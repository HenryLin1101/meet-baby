import { getSupabaseAdmin } from "@/lib/db/client";
import { listDriveFolderFiles, readDriveFileAsText } from "@/lib/google/driveFiles";
import { indexDriveFile } from "@/lib/ai/indexDriveFile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ScanResult = {
  groupId: number;
  fileId: string;
  fileName: string;
  status: "indexed" | "skipped" | "failed";
  chunks?: number;
  error?: string;
};

async function handleDriveScan() {
  const supabase = getSupabaseAdmin();

  // 取得所有有 Drive 資料夾的群組
  const { data: groups, error: groupsError } = await supabase
    .from("chat_groups")
    .select("id, line_group_id, drive_folder_id")
    .not("drive_folder_id", "is", null);

  if (groupsError) throw new Error(`讀取群組失敗：${groupsError.message}`);
  if (!groups || groups.length === 0) {
    return Response.json({ ok: true, message: "沒有群組有 Drive 資料夾。", results: [] });
  }

  // 取得所有已 index 的檔案紀錄
  const { data: indexedFiles } = await supabase
    .from("drive_indexed_files")
    .select("group_id, drive_file_id, drive_modified_time");

  const indexedMap = new Map<string, string | null>();
  for (const row of indexedFiles ?? []) {
    indexedMap.set(`${row.group_id}:${row.drive_file_id}`, row.drive_modified_time);
  }

  const results: ScanResult[] = [];

  for (const group of groups as { id: number; line_group_id: string; drive_folder_id: string }[]) {
    let files;
    try {
      files = await listDriveFolderFiles(group.drive_folder_id);
    } catch (err) {
      console.error(`[drive-scan] 列出群組 ${group.id} 檔案失敗：`, err);
      continue;
    }

    for (const file of files) {
      const key = `${group.id}:${file.id}`;
      const lastModified = indexedMap.get(key);

      // 已 index 且未修改，跳過
      if (lastModified !== undefined && lastModified === file.modifiedTime) {
        results.push({ groupId: group.id, fileId: file.id, fileName: file.name, status: "skipped" });
        continue;
      }

      try {
        const text = await readDriveFileAsText(file);
        if (!text) {
          results.push({ groupId: group.id, fileId: file.id, fileName: file.name, status: "skipped" });
          continue;
        }

        const chunks = await indexDriveFile({ groupId: group.id, file, text });

        // 更新 drive_indexed_files
        await supabase.from("drive_indexed_files").upsert({
          group_id: group.id,
          drive_file_id: file.id,
          file_name: file.name,
          mime_type: file.mimeType,
          drive_modified_time: file.modifiedTime,
          indexed_at: new Date().toISOString(),
        }, { onConflict: "group_id,drive_file_id" });

        results.push({ groupId: group.id, fileId: file.id, fileName: file.name, status: "indexed", chunks });
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error(`[drive-scan] index 失敗 ${file.name}：`, message);
        results.push({ groupId: group.id, fileId: file.id, fileName: file.name, status: "failed", error: message });
      }
    }
  }

  return Response.json({ ok: true, results });
}

// GET: 手動觸發掃描（測試用，不需要 QStash 簽名）
export async function GET() {
  return handleDriveScan();
}

export async function POST(request: Request) {
  const { verifySignatureAppRouter } = await import("@upstash/qstash/nextjs");
  return verifySignatureAppRouter(handleDriveScan)(request);
}
