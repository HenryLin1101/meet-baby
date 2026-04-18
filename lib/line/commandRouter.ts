import { HelpCommand } from "@/lib/line/commands/helpCommand";
import { MeetingCommand } from "@/lib/line/commands/meetingCommand";
import type { CommandContext } from "@/lib/modules/types";
import { CommandHandlerBase } from "@/lib/modules/types";

const EXPLICIT_PREFIXES = ["/", "!"] as const;

/** 註冊順序會影響關鍵字同時命中時的優先權（先註冊者優先）。 */
const registeredCommands: CommandHandlerBase[] = [
  new HelpCommand(),
  new MeetingCommand(),
];

const commandByName = Object.fromEntries(
  registeredCommands.map((cmd) => [cmd.name, cmd])
) as Record<string, CommandHandlerBase>;

export type RoutedCommand = {
  handler: CommandHandlerBase["handle"];
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
    const cmd = commandByName[explicit.command];
    if (!cmd) return null;
    return {
      handler: cmd.handle.bind(cmd),
      context: {
        rawText,
        normalizedText,
        args: explicit.args,
      },
    };
  }

  const keywordCommandName = resolveKeywordCommandName(normalizedText);
  if (!keywordCommandName) return null;

  const cmd = commandByName[keywordCommandName];
  if (!cmd) return null;

  return {
    handler: cmd.handle.bind(cmd),
    context: {
      rawText,
      normalizedText,
      args: [],
    },
  };
}
