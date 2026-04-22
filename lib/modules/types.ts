import type { ConversationState } from "@/lib/conversation/state";

export type CommandContext = {
  rawText: string;
  normalizedText: string;
  args: string[];
  lineGroupId?: string;
  lineUserId?: string;
};

/**
 * Quick reply 按鈕。
 * - 含 text：點擊後會替使用者送出 text 作為新訊息（message action）。
 * - 含 uri：點擊後會開啟該 URI（URI action，常用於 LIFF 連結）。
 */
export type QuickReplyOption =
  | { label: string; text: string; uri?: never }
  | { label: string; uri: string; text?: never };

/**
 * Command handler 的回覆 + 會話狀態更新指示。
 * - next 省略：單輪結束，不建立／不改動狀態。
 * - next = { step, data }：建立或更新會話狀態，下一則訊息會進 continueConversation。
 * - next = "end"：清除目前會話狀態。
 * - quickReplies：在訊息下方顯示快速回覆按鈕（LINE quick reply）。
 */
export type ConversationUpdate = {
  reply: string;
  quickReplies?: QuickReplyOption[];
  next?: { step: string; data: Record<string, unknown> } | "end";
};

/**
 * LINE 指令基底。
 * - name：顯式指令名稱（/name、!name）。
 * - keywords：關鍵字 fallback。
 * - start：首次觸發時呼叫。
 * - continueConversation：已在多輪流程中，下一則訊息進來時呼叫（選配）。
 */
export abstract class CommandHandlerBase {
  abstract readonly name: string;
  abstract readonly keywords: readonly string[];

  abstract start(
    context: CommandContext
  ): Promise<ConversationUpdate> | ConversationUpdate;

  continueConversation?(
    state: ConversationState,
    context: CommandContext
  ): Promise<ConversationUpdate> | ConversationUpdate;
}
