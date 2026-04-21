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

  const note = input.note?.trim();
  if (note) lines.push(`備註：${note}`);

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

export function buildMeetingReminderMentionMessage(
  input: Omit<EventMentionMessageInput, "heading" | "prefixLine">
) {
  return buildEventMentionMessage({
    ...input,
    heading: "【會議提醒】",
    prefixLine: "將於 5 分鐘後開始，請準時出席。",
  });
}
