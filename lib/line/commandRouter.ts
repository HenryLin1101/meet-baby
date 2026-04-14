import { helpCommand } from "@/lib/line/commands/helpCommand";
import type {
  CommandContext,
  CommandHandler,
} from "@/lib/line/commands/types";

const EXPLICIT_PREFIXES = ["/", "!"] as const;
const HELP_KEYWORDS = ["help", "幫助", "指令"] as const;

const commandHandlers: Record<string, CommandHandler> = {
  help: helpCommand,
};

export type RoutedCommand = {
  handler: CommandHandler;
  context: CommandContext;
};

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function parseExplicitCommand(normalizedText: string): {
  command: string;
  args: string[];
} | null {
  const hasPrefix = EXPLICIT_PREFIXES.some((prefix) =>
    normalizedText.startsWith(prefix)
  );
  if (!hasPrefix) return null;

  const withoutPrefix = normalizedText.slice(1).trim();
  if (!withoutPrefix) return null;

  const [command, ...args] = withoutPrefix.split(/\s+/);
  return { command, args };
}

function resolveKeywordCommand(normalizedText: string): string | null {
  const matched = HELP_KEYWORDS.some((keyword) => normalizedText.includes(keyword));
  if (matched) return "help";
  return null;
}

export function routeCommand(rawText: string): RoutedCommand | null {
  const normalizedText = normalizeText(rawText);
  const explicit = parseExplicitCommand(normalizedText);

  if (explicit) {
    const handler = commandHandlers[explicit.command];
    if (!handler) return null;
    return {
      handler,
      context: {
        rawText,
        normalizedText,
        args: explicit.args,
      },
    };
  }

  const keywordCommand = resolveKeywordCommand(normalizedText);
  if (!keywordCommand) return null;

  return {
    handler: commandHandlers[keywordCommand],
    context: {
      rawText,
      normalizedText,
      args: [],
    },
  };
}
