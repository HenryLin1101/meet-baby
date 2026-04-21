import { describe, expect, it } from "vitest";
import {
  EVENT_REMINDER_LEAD_TIME_MS,
  resolveReminderScheduleTime,
  toUnixTimestampSeconds,
} from "./schedule";

describe("resolveReminderScheduleTime", () => {
  it("schedules five minutes before the meeting when there is enough lead time", () => {
    const now = new Date("2026-04-21T10:00:00.000Z");
    const startsAt = new Date(now.getTime() + 30 * 60 * 1000);

    const reminderTime = resolveReminderScheduleTime(startsAt, now);

    expect(reminderTime?.toISOString()).toBe(
      new Date(startsAt.getTime() - EVENT_REMINDER_LEAD_TIME_MS).toISOString()
    );
  });

  it("falls back to an immediate reminder when the meeting is within five minutes", () => {
    const now = new Date("2026-04-21T10:00:00.000Z");
    const startsAt = new Date(now.getTime() + 2 * 60 * 1000);

    const reminderTime = resolveReminderScheduleTime(startsAt, now);

    expect(reminderTime?.toISOString()).toBe("2026-04-21T10:00:05.000Z");
  });

  it("returns null for meetings that already started", () => {
    const now = new Date("2026-04-21T10:00:00.000Z");
    const startsAt = new Date("2026-04-21T09:59:59.000Z");

    expect(resolveReminderScheduleTime(startsAt, now)).toBeNull();
  });
});

describe("toUnixTimestampSeconds", () => {
  it("converts valid dates into epoch seconds", () => {
    expect(toUnixTimestampSeconds("2026-04-21T10:00:05.000Z")).toBe(1776765605);
  });

  it("returns null for invalid dates", () => {
    expect(toUnixTimestampSeconds("invalid-date")).toBeNull();
  });
});
