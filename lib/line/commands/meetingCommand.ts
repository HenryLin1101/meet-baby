import {
  createMeeting,
  parseMeetingTime,
} from "@/lib/modules/meeting";
import type { ConversationState } from "@/lib/conversation/state";
import {
  CommandHandlerBase,
  type CommandContext,
  type ConversationUpdate,
  type QuickReplyOption,
} from "@/lib/modules/types";

const STEP_AWAIT_TITLE = "awaitingTitle";
const STEP_AWAIT_TIME = "awaitingTime";
const STEP_AWAIT_CONFIRM = "awaitingConfirm";

const YES_ANSWERS = new Set(["是", "y", "yes", "確認", "ok"]);
const NO_ANSWERS = new Set(["否", "n", "no", "取消確認"]);

/** 文字模式子指令：點「改用聊天填寫」時會送出這段文字，要有別名讓 bot 被喚醒。 */
const TEXT_MODE_PAYLOAD = "米特寶寶 /meeting text";

function buildLiffUrl(): string | null {
  const id = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  return id ? `https://liff.line.me/${id}` : null;
}

export class MeetingCommand extends CommandHandlerBase {
  readonly name = "meeting";
  readonly keywords = ["meeting", "會議", "預約"] as const;

  start(context: CommandContext): ConversationUpdate {
    const mode = context.args[0];
    const liffUrl = buildLiffUrl();

    // 明確選擇走文字流程，或沒設定 LIFF 時直接進文字流程
    if (mode === "text" || !liffUrl) {
      return {
        reply: "開始預約會議。請輸入會議主題：",
        next: { step: STEP_AWAIT_TITLE, data: {} },
      };
    }

    const quickReplies: QuickReplyOption[] = [
      { label: "開啟預約表單", uri: liffUrl },
      { label: "改用聊天填寫", text: TEXT_MODE_PAYLOAD },
    ];
    return {
      reply: "請選擇預約方式：",
      quickReplies,
    };
  }

  continueConversation(
    state: ConversationState,
    context: CommandContext
  ): ConversationUpdate {
    switch (state.step) {
      case STEP_AWAIT_TITLE: {
        const title = context.rawText.trim();
        if (!title) {
          return { reply: "主題不可為空，請再輸入一次：" };
        }
        return {
          reply: "請輸入會議時間（格式：YYYY-MM-DD HH:mm，例如 2026-04-20 15:00）：",
          next: {
            step: STEP_AWAIT_TIME,
            data: { ...state.data, title },
          },
        };
      }
      case STEP_AWAIT_TIME: {
        const time = parseMeetingTime(context.rawText);
        if (!time) {
          return {
            reply: "時間格式不正確，請使用 YYYY-MM-DD HH:mm，例如 2026-04-20 15:00：",
          };
        }
        const title = String(state.data.title ?? "");
        return {
          reply: [
            "請確認會議資訊：",
            `- 主題：${title}`,
            `- 時間：${time}`
          ].join("\n"),
          quickReplies: [
            { label: "是", text: "是" },
            { label: "否", text: "否" },
          ],
          next: {
            step: STEP_AWAIT_CONFIRM,
            data: { ...state.data, time },
          },
        };
      }
      case STEP_AWAIT_CONFIRM: {
        const answer = context.normalizedText;
        if (YES_ANSWERS.has(answer)) {
          const title = String(state.data.title ?? "");
          const time = String(state.data.time ?? "");
          const meeting = createMeeting({ title, time });
          return {
            reply: `已建立會議：「${meeting.title}」於 ${meeting.time}。`,
            next: "end",
          };
        }
        if (NO_ANSWERS.has(answer)) {
          return { reply: "已取消這次預約。", next: "end" };
        }
        return { reply: "請回覆「是」或「否」。" };
      }
      default:
        return { reply: "流程狀態異常，已重置。", next: "end" };
    }
  }
}
