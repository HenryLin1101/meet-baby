import { HelpCommand } from "@/lib/line/commands/helpCommand";
import { LiffCommand } from "@/lib/line/commands/liffCommand";
import { MeetingCommand } from "@/lib/line/commands/meetingCommand";
import type { CommandContext } from "@/lib/modules/types";
import { CommandHandlerBase } from "@/lib/modules/types";

const EXPLICIT_PREFIXES = ["/", "!"] as const;

/** 註冊順序影響關鍵字同時命中時的優先權（先註冊者優先）。 */
const registeredCommands: CommandHandlerBase[] = [
  new HelpCommand(),
  new MeetingCommand(),
  new LiffCommand(),
];

const commandByName = Object.fromEntries(
  registeredCommands.map((cmd) => [cmd.name, cmd])
) as Record<string, CommandHandlerBase>;

export type RoutedCommand = {
  command: CommandHandlerBase;
  context: CommandContext;
};

export function getCommandByName(name: string): CommandHandlerBase | null {
  return commandByName[name] ?? null;
}

export function normalizeText(text: string): string {
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

function resolveKeywordCommandName(normalizedText: string): string | null {
  for (const cmd of registeredCommands) {
    const hit = cmd.keywords.some((kw) =>
      normalizedText.includes(kw.toLowerCase())
    );
    if (hit) return cmd.name;
  }
  return null;
}

export function routeCommand(rawText: string): RoutedCommand | null {
  const normalizedText = normalizeText(rawText);
  const explicit = parseExplicitCommand(normalizedText);

  if (explicit) {
    const command = commandByName[explicit.command];
    if (!command) return null;
    return {
      command,
      context: {
        rawText,
        normalizedText,
        args: explicit.args,
      },
    };
  }

  const keywordName = resolveKeywordCommandName(normalizedText);
  if (!keywordName) return null;
  const command = commandByName[keywordName];
  if (!command) return null;

  return {
    command,
    context: { rawText, normalizedText, args: [] },
  };
}
