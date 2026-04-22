import {
  createEventSummary,
  getGoogleCredentialByLineUserId,
  setEventSummaryQStashMessageId,
} from "@/lib/db/repository";
import { buildLiffUrl } from "@/lib/liff/utils";
import { extractFirstUrl, parseGoogleDriveLink } from "@/lib/google/driveLink";
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
      const oauthLiff = buildLiffUrl("/liff/google-auth", {
        groupId: context.lineGroupId,
      });
      if (!oauthLiff) {
        return {
          reply:
            "需要先授權 Google Drive 才能讀取逐字稿，但目前尚未設定 LIFF。請先設定 NEXT_PUBLIC_LIFF_ID。",
        };
      }

      return {
        reply: [
          "我需要取得你的 Google Drive 權限才能讀取這份逐字稿。",
          "請點下方連結一鍵授權，完成後再把檔案連結貼一次給我。",
        ].join("\n"),
        quickReplies: [{ label: "一鍵授權 Google", uri: oauthLiff }],
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

