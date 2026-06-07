import { formatMeetingDateTime } from "@/lib/modules/meeting";

type MentionTarget = {
  lineUserId: string;
};

type EventMentionMessageInput = {
  heading: string;
  title: string;
  startsAt: string | Date;
  timezone?: string;
  location?: string | null;
  note?: string | null;
  meetingUrl?: string | null;
  driveFolderUrl?: string | null;
  attendees: MentionTarget[];
  prefixLine?: string;
};

function buildMentionSubstitution(attendees: MentionTarget[]) {
  return Object.fromEntries(
    attendees.map((attendee, index) => [
      `user${index + 1}`,
      {
        type: "mention" as const,
        mentionee: {
          type: "user" as const,
          userId: attendee.lineUserId,
        },
      },
    ])
  );
}

export function formatLeadTime(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} 天`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} 小時`;
  }
  return `${minutes} 分鐘`;
}

export function buildEventMentionMessage(input: EventMentionMessageInput) {
  const lines = [
    input.heading,
    `主題：${input.title}`,
    `時間：${formatMeetingDateTime(input.startsAt, input.timezone)}`,
  ];

  const prefixLine = input.prefixLine?.trim();
  if (prefixLine) lines.push(prefixLine);

  const location = input.location?.trim();
  if (location) lines.push(`地點：${location}`);

  const attendeePlaceholders = input.attendees.map((_, index) => `{user${index + 1}}`);
  if (attendeePlaceholders.length > 0) {
    lines.push(`參與者：${attendeePlaceholders.join("、")}`);
  }

  const meetingUrl = input.meetingUrl?.trim();
  if (meetingUrl) lines.push(`Meet：${meetingUrl}`);

  const note = input.note?.trim();
  if (note) lines.push(`備註：${note}`);

  const driveFolderUrl = input.driveFolderUrl?.trim();
  if (driveFolderUrl) lines.push(`📁 會議資料夾：\n${driveFolderUrl}`);

  return {
    type: "textV2" as const,
    text: lines.join("\n"),
    substitution: buildMentionSubstitution(input.attendees),
  };
}

export function buildMeetingCreatedMentionMessage(
  input: Omit<EventMentionMessageInput, "heading" | "prefixLine">
) {
  return buildEventMentionMessage({
    ...input,
    heading: "【會議預約】",
  });
}

export function buildMeetingCancelledMessage(input: {
  title: string;
  startsAt: string | Date;
  timezone?: string;
  cancelledBy?: string | null;
}) {
  const lines = [
    "【會議取消】",
    `主題：${input.title}`,
    `原時間：${formatMeetingDateTime(input.startsAt, input.timezone)}`,
  ];
  const cancelledBy = input.cancelledBy?.trim();
  if (cancelledBy) lines.push(`取消者：${cancelledBy}`);
  return { type: "text" as const, text: lines.join("\n") };
}

export function buildMeetingReminderMentionMessage(
  input: Omit<EventMentionMessageInput, "heading" | "prefixLine"> & {
    leadTimeMinutes?: number;
  }
) {
  const lead = formatLeadTime(input.leadTimeMinutes ?? 5);
  return buildEventMentionMessage({
    ...input,
    heading: "【會議提醒】",
    prefixLine: `將於 ${lead}後開始，請準時出席。`,
  });
}

type RecurringMeetingCreatedInput = {
  title: string;
  time: string;
  weekdayNames: string[];
  firstDate: string;
  lastDate: string;
  count: number;
  attendees: MentionTarget[];
  note?: string | null;
};

export function buildRecurringMeetingCreatedMessage(input: RecurringMeetingCreatedInput) {
  const attendeePlaceholders = input.attendees.map((_, index) => `{user${index + 1}}`);
  const lines = [
    "【重複會議預約】",
    `主題：${input.title}`,
    `時間：每週 ${input.weekdayNames.join("、")} ${input.time}`,
    `首次：${input.firstDate}`,
    `最後：${input.lastDate}（共 ${input.count} 場）`,
  ];
  if (attendeePlaceholders.length > 0) {
    lines.push(`參與者：${attendeePlaceholders.join("、")}`);
  }
  const note = input.note?.trim();
  if (note) lines.push(`備註：${note}`);

  return {
    type: "textV2" as const,
    text: lines.join("\n"),
    substitution: buildMentionSubstitution(input.attendees),
  };
}
