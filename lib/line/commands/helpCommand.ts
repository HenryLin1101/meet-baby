import {
  CommandHandlerBase,
  type CommandContext,
  type CommandResult,
} from "@/lib/modules/types";



const HELP_MESSAGE = [
  "可用指令：",
  "/help 或 !help：顯示這份說明",
  "/meeting 或 !meeting：會議相關（開發中）",
  "",
  "你也可以直接輸入「幫助」或「help」；「會議」或「meeting」可觸發會議說明。",
].join("\n");



export class HelpCommand extends CommandHandlerBase {
  readonly name = "help";
  readonly keywords = ["help", "幫助", "指令"] as const;

  async handle(context: CommandContext): Promise<CommandResult> {
    void context;
    return { text: HELP_MESSAGE };
  }

}
