export const EVENT_REMINDER_LEAD_TIME_MS = 5 * 60 * 1000;
const IMMEDIATE_REMINDER_DELAY_MS = 5 * 1000;

export function resolveReminderScheduleTime(
  startsAt: string | Date,
  now = new Date()
): Date | null {
  const startDate = startsAt instanceof Date ? startsAt : new Date(startsAt);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const nowTime = now.getTime();
  const startTime = startDate.getTime();
  if (startTime <= nowTime) {
    return null;
  }

  const reminderTime = startTime - EVENT_REMINDER_LEAD_TIME_MS;
  if (reminderTime <= nowTime) {
    return new Date(nowTime + IMMEDIATE_REMINDER_DELAY_MS);
  }

  return new Date(reminderTime);
}

export function toUnixTimestampSeconds(value: string | Date): number | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.floor(date.getTime() / 1000);
}
