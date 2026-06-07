import { getGoogleCredentialByLineUserId } from "@/lib/db/repository";
import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";
import {
  CommandHandlerBase,
  type CommandContext,
  type ConversationUpdate,
} from "@/lib/modules/types";
import type { ConversationState } from "@/lib/conversation/state";
import { runTactiqScanForGroup } from "@/lib/summaries/tactiqScan";
import {
  buildMeetingSelectionReplies,
  buildQuickRepliesFromOptions,
  parseMeetingSelection,
  type MeetingOption,
} from "@/lib/line/meetingSelection";

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

    const { options, quickReplies } = await buildMeetingSelectionReplies(
      context.lineGroupId
    );

    if (options.length === 0) {
      return this.doScan(context.lineGroupId, hostLineUserId, null);
    }

    return {
      reply: "這是哪場會議的逐字稿？（選擇後開始掃描 Tactiq Drive 資料夾）",
      quickReplies,
      next: {
        step: "awaiting_meeting",
        data: { hostLineUserId, options },
      },
    };
  }

  async continueConversation(
    state: ConversationState,
    context: CommandContext
  ): Promise<ConversationUpdate> {
    if (state.step !== "awaiting_meeting") {
      return { reply: "發生錯誤，請重新輸入「掃描逐字稿」。", next: "end" };
    }

    const options = Array.isArray(state.data.options)
      ? (state.data.options as MeetingOption[])
      : [];
    const selection = parseMeetingSelection(context.rawText, options);

    if (!selection.matched) {
      return {
        reply: "請點選下方按鈕選擇會議，或按「不指定」跳過。",
        quickReplies: buildQuickRepliesFromOptions(options),
        next: { step: state.step, data: state.data },
      };
    }

    const hostLineUserId = String(state.data.hostLineUserId ?? "");
    const lineGroupId = context.lineGroupId ?? "";

    return {
      ...(await this.doScan(lineGroupId, hostLineUserId, selection.eventId)),
      next: "end",
    };
  }

  private async doScan(
    lineGroupId: string,
    hostLineUserId: string,
    eventId: number | null
  ): Promise<ConversationUpdate> {
    const result = await runTactiqScanForGroup({
      lineGroupId,
      hostLineUserId,
      eventId,
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
