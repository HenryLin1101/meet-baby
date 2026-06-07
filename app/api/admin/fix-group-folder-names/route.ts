import {
  ensureChatGroup,
  listGroupsNeedingFolderNameFix,
} from "@/lib/db/repository";
import { renameDriveFolder } from "@/lib/google/driveAdmin";
import { createMessagingClient } from "@/lib/line/messagingClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GroupResult = {
  lineGroupId: string;
  oldName: string | null;
  newName: string;
  status: "renamed" | "skipped" | "error";
  error?: string;
};

export async function POST(_request: Request) {
  const groups = await listGroupsNeedingFolderNameFix();
  if (groups.length === 0) {
    return Response.json({ message: "沒有需要修正的群組。", results: [] });
  }

  const client = createMessagingClient();
  const results: GroupResult[] = [];

  for (const group of groups) {
    try {
      const summary = await client.getGroupSummary(group.lineGroupId);
      const newName = summary.groupName?.trim();

      if (!newName || newName === "LINE 群組") {
        results.push({
          lineGroupId: group.lineGroupId,
          oldName: group.currentName,
          newName: newName ?? "(無法取得)",
          status: "skipped",
        });
        continue;
      }

      await renameDriveFolder(group.driveFolderId, newName);
      await ensureChatGroup(group.lineGroupId, newName);

      results.push({
        lineGroupId: group.lineGroupId,
        oldName: group.currentName,
        newName,
        status: "renamed",
      });
    } catch (err) {
      results.push({
        lineGroupId: group.lineGroupId,
        oldName: group.currentName,
        newName: "",
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const renamed = results.filter((r) => r.status === "renamed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  return Response.json({
    message: `完成：${renamed} 個已改名、${skipped} 個略過、${errors} 個失敗。`,
    results,
  });
}
