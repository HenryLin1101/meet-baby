import {
  createEventSummary,
  getGoogleCredentialByLineUserId,
  setEventSummaryQStashMessageId,
} from "@/lib/db/repository";
import { extractFirstUrl, parseGoogleDriveLink } from "@/lib/google/driveLink";
import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";
import { CommandHandlerBase, type CommandContext, type ConversationUpdate } from "@/lib/modules/types";
import { publishSummaryJob } from "@/lib/summaries/qstash";

export class SummaryCommand extends CommandHandlerBase {
  readonly name = "summary";
  readonly keywords = ["summary", "總結", "摘要", "會議總結", "幫我總結"] as const;

  async start(context: CommandContext): Promise<ConversationUpdate> {
    if (!context.lineGroupId) {
      return { reply: "請在群組內使用「會議總結」功能，並貼上 Google Drive/Docs 逐字稿連結。" };
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
      return { reply: "我看不懂這個連結，請確認是 Google Drive/Docs 的檔案連結。" };
    }

    const credential = await getGoogleCredentialByLineUserId(context.lineUserId);
    if (!credential) {
      // Create a pending summary record first, so OAuth callback can resume automatically.
      const created = await createEventSummary({
        lineGroupId: context.lineGroupId,
        requestedByLineUserId: context.lineUserId,
        sourceDriveUrl: parsed.normalizedUrl,
        sourceDriveFileId: parsed.fileId,
      });

      const consentUrl = new URL("/api/google/oauth/consent", getAppBaseUrlOrThrow());
      consentUrl.searchParams.set("lineUserId", context.lineUserId);
      consentUrl.searchParams.set("summaryId", String(created.summaryId));

      return {
        reply: [
          "我需要取得你的 Google Drive 權限才能讀取這份逐字稿。",
          "請用 Safari/Chrome 開啟下方連結完成授權（LINE 內建瀏覽器會被 Google 擋）。",
          consentUrl.toString(),
          "授權完成後，我會自動開始整理並把總結回傳到群組，不需要再貼一次連結。",
          `任務編號：${created.summaryId}`,
        ].join("\n"),
      };
    }

    const created = await createEventSummary({
      lineGroupId: context.lineGroupId,
      requestedByLineUserId: context.lineUserId,
      sourceDriveUrl: parsed.normalizedUrl,
      sourceDriveFileId: parsed.fileId,
    });

    const job = await publishSummaryJob({ summaryId: created.summaryId });
    await setEventSummaryQStashMessageId({
      summaryId: created.summaryId,
      messageId: job.messageId,
    });

    return {
      reply: [
        "已收到，我正在整理這場會議的主軸與總結。",
        `任務編號：${created.summaryId}`,
      ].join("\n"),
    };
  }
}

