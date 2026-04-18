import {
  CommandHandlerBase,
  type ConversationUpdate,
} from "@/lib/modules/types";

const HELP_MESSAGE = [
  "可用指令：",
  "/help 或 !help：顯示這份說明",
  "/meeting 或 !meeting：預約會議（多輪對話）",
  "",
  "對話中隨時輸入「取消」或「cancel」可中止目前流程。",
].join("\n");

export class HelpCommand extends CommandHandlerBase {
  readonly name = "help";
  readonly keywords = ["help", "幫助", "指令"] as const;

  start(): ConversationUpdate {
    return { reply: HELP_MESSAGE };
  }
}
