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
