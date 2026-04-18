import {
  createMeeting,
  parseMeetingTime,
} from "@/lib/modules/meeting";
import type { ConversationState } from "@/lib/conversation/state";
import {
  CommandHandlerBase,
  type CommandContext,
  type ConversationUpdate,
} from "@/lib/modules/types";

const STEP_AWAIT_TITLE = "awaitingTitle";
const STEP_AWAIT_TIME = "awaitingTime";
const STEP_AWAIT_CONFIRM = "awaitingConfirm";

const YES_ANSWERS = new Set(["是", "y", "yes", "確認", "ok"]);
const NO_ANSWERS = new Set(["否", "n", "no", "取消確認"]);

export class MeetingCommand extends CommandHandlerBase {
  readonly name = "meeting";
  readonly keywords = ["meeting", "會議", "預約"] as const;

  start(): ConversationUpdate {
    return {
      reply: "開始預約會議。請輸入會議主題：",
      next: { step: STEP_AWAIT_TITLE, data: {} },
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
