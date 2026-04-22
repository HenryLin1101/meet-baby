import {
  getGroupNextEvent,
  isEventAttendee,
  getUserNextEvent,
  type UpcomingEvent,
} from "@/lib/db/repository";
import {
  CommandHandlerBase,
  type CommandContext,
  type ConversationUpdate,
} from "@/lib/modules/types";

const NO_GROUP_MESSAGE = "請在群組中使用這個指令。";
const NO_UPCOMING_MESSAGE = "目前沒有即將到來的會議。";
const NO_USER_UPCOMING_MESSAGE = "你目前沒有其他即將到來的會議。";

function formatEventLine(prefix: string, event: UpcomingEvent): string {
  const startsAt = new Date(event.startsAt);
  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: event.timezone || "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const location = event.location ? `，地點：${event.location}` : "";
  return `${prefix}${event.title}（${formatter.format(startsAt)}${location}）`;
}

export class UpcomingCommand extends CommandHandlerBase {
  readonly name = "upcoming";
  readonly keywords = ["upcoming", "即將到來", "下次會議", "下一場"] as const;

  async start(context: CommandContext): Promise<ConversationUpdate> {
    const lineGroupId = context.lineGroupId;
    if (!lineGroupId) {
      return { reply: NO_GROUP_MESSAGE };
    }

    const groupNext = await getGroupNextEvent(lineGroupId);
    if (!groupNext) {
      return { reply: NO_UPCOMING_MESSAGE };
    }

    const lines: string[] = [formatEventLine("這個群組的下一場會議：", groupNext)];
    const callerLineUserId = context.lineUserId;

    if (callerLineUserId) {
      const callerIsAttendee = await isEventAttendee(groupNext.eventId, callerLineUserId);
      if (!callerIsAttendee) {
        const userNext = await getUserNextEvent(callerLineUserId);
        lines.push("");
        lines.push(
          userNext
            ? formatEventLine("你的下一場會議：", userNext)
            : NO_USER_UPCOMING_MESSAGE
        );
      }
    }

    return { reply: lines.join("\n") };
  }
}
