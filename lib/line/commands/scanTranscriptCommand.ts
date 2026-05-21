import { getGoogleCredentialByLineUserId } from "@/lib/db/repository";
import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";
import {
  CommandHandlerBase,
  type CommandContext,
  type ConversationUpdate,
} from "@/lib/modules/types";
import { runTactiqScanForGroup } from "@/lib/summaries/tactiqScan";

export class ScanTranscriptCommand extends CommandHandlerBase {
  readonly name = "scan-transcript";
  readonly keywords = ["掃描逐字稿", "自動摘要", "scan transcript"] as const;

  async start(context: CommandContext): Promise<ConversationUpdate> {
    if (!context.lineGroupId) {
      return { reply: "請在群組內使用「掃描逐字稿」。" };
    }
    if (!context.lineUserId) {
      return { reply: "無法取得使用者資訊，請從群組內重新嘗試。" };
    }

    const hostLineUserId =
      process.env.TACTIQ_HOST_LINE_USER_ID?.trim() || context.lineUserId;

    const credential = await getGoogleCredentialByLineUserId(hostLineUserId);
    if (!credential) {
      const consentUrl = new URL("/api/google/oauth/consent", getAppBaseUrlOrThrow());
      consentUrl.searchParams.set("lineUserId", hostLineUserId);
      consentUrl.searchParams.set("groupId", context.lineGroupId);

      return {
        reply: [
          "需要 Google Drive 授權才能掃描 Tactiq 逐字稿。",
          "請用 Safari/Chrome 開啟下方連結完成授權：",
          consentUrl.toString(),
        ].join("\n"),
      };
    }

    const result = await runTactiqScanForGroup({
      lineGroupId: context.lineGroupId,
      hostLineUserId,
    });

    if (result.status === "started") {
      return {
        reply: "已在 Drive 找到逐字稿，正在整理會議重點，完成後會推送到群組。",
      };
    }

    if (result.status === "failed" && result.message === "transcript_not_found") {
      return {
        reply: [
          "在 Tactiq 資料夾找不到最近的逐字稿。",
          "請確認會議已結束、Tactiq 已同步到 Drive，或稍後再試。",
        ].join("\n"),
      };
    }

    return {
      reply: `掃描失敗：${result.status === "failed" ? result.message : "未知錯誤"}`,
    };
  }
}
