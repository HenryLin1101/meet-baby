import {
  createEventSummary,
  getGoogleCredentialByLineUserId,
  setEventSummaryQStashMessageId,
} from "@/lib/db/repository";
import { extractFirstUrl, parseGoogleDriveLink } from "@/lib/google/driveLink";
import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";
import {
  CommandHandlerBase,
  type CommandContext,
  type ConversationUpdate,
} from "@/lib/modules/types";
import type { ConversationState } from "@/lib/conversation/state";
import { publishSummaryJob } from "@/lib/summaries/qstash";
import {
  buildMeetingSelectionReplies,
  buildQuickRepliesFromOptions,
  parseMeetingSelection,
  type MeetingOption,
} from "@/lib/line/meetingSelection";

export class SummaryCommand extends CommandHandlerBase {
  readonly name = "summary";
  readonly keywords = ["summary", "總結", "摘要", "會議總結", "幫我總結"] as const;

  async start(context: CommandContext): Promise<ConversationUpdate> {
    if (!context.lineGroupId) {
      return {
        reply:
          "請在群組內使用「會議總結」功能，並貼上 Google Drive/Docs 逐字稿連結。",
      };
    }
    if (!context.lineUserId) {
      return { reply: "無法取得使用者資訊，請從群組內重新嘗試。" };
    }

    const linkCandidate = extractFirstUrl(context.rawText);
    if (!linkCandidate) {
      return {
        reply: [
          "請貼上 Google Drive/Docs 逐字稿連結。",
          "範例：@米特寶寶 幫我總結這場會議 https://docs.google.com/document/d/......",
        ].join("\n"),
      };
    }

    const parsed = parseGoogleDriveLink(linkCandidate);
    if (!parsed) {
      return {
        reply: "我看不懂這個連結，請確認是 Google Drive/Docs 的檔案連結。",
      };
    }

    const credential = await getGoogleCredentialByLineUserId(context.lineUserId);
    if (!credential) {
      const created = await createEventSummary({
        lineGroupId: context.lineGroupId,
        requestedByLineUserId: context.lineUserId,
        sourceDriveUrl: parsed.normalizedUrl,
        sourceDriveFileId: parsed.fileId,
      });

      const consentUrl = new URL(
        "/api/google/oauth/consent",
        getAppBaseUrlOrThrow()
      );
      consentUrl.searchParams.set("lineUserId", context.lineUserId);
      consentUrl.searchParams.set("summaryId", String(created.summaryId));

      return {
        reply: [
          "我需要取得你的 Google Drive 權限才能讀取這份逐字稿。",
          "請用 Safari/Chrome 開啟下方連結完成授權（LINE 內建瀏覽器會被 Google 擋）。",
          consentUrl.toString(),
          "授權完成後，我會自動開始整理並把總結回傳到群組，不需要再貼一次連結。",
        ].join("\n"),
      };
    }

    const { options, quickReplies } = await buildMeetingSelectionReplies(
      context.lineGroupId
    );

    if (options.length === 0) {
      return this.doSummary(
        context.lineGroupId,
        context.lineUserId,
        parsed.normalizedUrl,
        parsed.fileId,
        null
      );
    }

    return {
      reply: "這是哪場會議的逐字稿？",
      quickReplies,
      next: {
        step: "awaiting_meeting",
        data: {
          options,
          sourceDriveUrl: parsed.normalizedUrl,
          sourceDriveFileId: parsed.fileId,
        },
      },
    };
  }

  async continueConversation(
    state: ConversationState,
    context: CommandContext
  ): Promise<ConversationUpdate> {
    if (state.step !== "awaiting_meeting") {
      return {
        reply: "發生錯誤，請重新輸入「幫我總結」並附上連結。",
        next: "end",
      };
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

    const sourceDriveUrl = String(state.data.sourceDriveUrl ?? "");
    const sourceDriveFileId = String(state.data.sourceDriveFileId ?? "");
    const lineGroupId = context.lineGroupId ?? "";
    const lineUserId = context.lineUserId ?? "";

    return {
      ...(await this.doSummary(
        lineGroupId,
        lineUserId,
        sourceDriveUrl,
        sourceDriveFileId,
        selection.eventId
      )),
      next: "end",
    };
  }

  private async doSummary(
    lineGroupId: string,
    lineUserId: string,
    sourceDriveUrl: string,
    sourceDriveFileId: string,
    eventId: number | null
  ): Promise<ConversationUpdate> {
    const created = await createEventSummary({
      lineGroupId,
      requestedByLineUserId: lineUserId,
      sourceDriveUrl,
      sourceDriveFileId,
      eventId,
    });
    const job = await publishSummaryJob({ summaryId: created.summaryId });
    await setEventSummaryQStashMessageId({
      summaryId: created.summaryId,
      messageId: job.messageId,
    });
    return { reply: "已收到，我正在整理這場會議的主軸與總結。" };
  }
}
