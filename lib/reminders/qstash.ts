import { createQStashClient, getEventReminderCallbackUrl } from "@/lib/qstash/client";
import {
  resolveReminderScheduleTime,
  toUnixTimestampSeconds,
} from "@/lib/reminders/schedule";

export type EventReminderJobPayload = {
  eventId: number;
};

export type PublishedEventReminder = {
  messageId: string;
  scheduledAt: string;
};

export async function publishEventReminder(input: {
  eventId: number;
  startsAt: string;
  leadTimeMinutes?: number;
}): Promise<PublishedEventReminder | null> {
  const leadTimeMs =
    input.leadTimeMinutes != null
      ? input.leadTimeMinutes * 60_000
      : undefined;
  const reminderTime = resolveReminderScheduleTime(input.startsAt, leadTimeMs);
  if (!reminderTime) {
    return null;
  }

  const notBefore = toUnixTimestampSeconds(reminderTime);
  if (notBefore === null) {
    return null;
  }

  const client = createQStashClient();
  const response = await client.publishJSON<EventReminderJobPayload>({
    url: getEventReminderCallbackUrl(),
    body: {
      eventId: input.eventId,
    },
    notBefore,
  });
  const messageId = Array.isArray(response)
    ? response[0]?.messageId
    : response.messageId;
  if (!messageId) {
    throw new Error("QStash 未回傳 messageId。");
  }

  return {
    messageId,
    scheduledAt: reminderTime.toISOString(),
  };
}

export async function cancelEventReminder(messageId: string): Promise<void> {
  const trimmedMessageId = messageId.trim();
  if (!trimmedMessageId) {
    return;
  }

  const client = createQStashClient();
  await client.messages.cancel(trimmedMessageId);
}
