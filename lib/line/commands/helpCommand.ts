import type { CommandHandler } from "@/lib/line/commands/types";

const HELP_MESSAGE = [
  "可用指令：",
  "/help 或 !help：顯示這份說明",
  "",
  "你也可以直接輸入「幫助」或「help」。",
].join("\n");

export const helpCommand: CommandHandler = async () => {
  return { text: HELP_MESSAGE };
};
