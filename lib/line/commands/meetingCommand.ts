import { getMeetingReplyMessage } from "@/lib/modules/meeting";

import {
  CommandHandlerBase,
  type CommandContext,
  type CommandResult,
} from "@/lib/modules/types";



export class MeetingCommand extends CommandHandlerBase {
  readonly name = "meeting";
  readonly keywords = [
    "meeting",
    "會議",
    "預約",
  ] as const;

  async handle(context: CommandContext): Promise<CommandResult> {
    void context;
    return { text: getMeetingReplyMessage() };
  }

}

