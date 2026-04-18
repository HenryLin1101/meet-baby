export type CommandResult = {
  text: string;
};

export type CommandContext = {
  rawText: string;
  normalizedText: string;
  args: string[];
};

export type CommandHandler = (
  context: CommandContext
) => Promise<CommandResult> | CommandResult;

/**
 * LINE 指令：顯式名稱（/name）與關鍵字 fallback 都由此類別描述。
 */
export abstract class CommandHandlerBase {
  abstract readonly name: string;
  abstract readonly keywords: readonly string[];

  abstract handle(
    context: CommandContext
  ): Promise<CommandResult> | CommandResult;
}
