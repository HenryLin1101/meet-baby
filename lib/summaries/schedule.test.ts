import { describe, expect, it } from "vitest";
import {
  AUTO_SUMMARY_FIRST_SCAN_DELAY_MS,
  DEFAULT_MEETING_DURATION_MS,
  resolveAutoSummaryFirstScanTime,
  resolveEstimatedEventEnd,
} from "@/lib/summaries/schedule";

describe("summaries/schedule", () => {
  it("uses ends_at when provided", () => {
    const end = resolveEstimatedEventEnd(
      "2026-05-16T09:00:00+08:00",
      "2026-05-16T10:30:00+08:00"
    );
    expect(end.toISOString()).toBe("2026-05-16T02:30:00.000Z");
  });

  it("defaults to starts_at + 60 minutes when ends_at is missing", () => {
    const start = "2026-05-16T09:00:00+08:00";
    const end = resolveEstimatedEventEnd(start, null);
    expect(end.getTime() - new Date(start).getTime()).toBe(DEFAULT_MEETING_DURATION_MS);
  });

  it("schedules first scan after estimated end plus delay", () => {
    const startsAt = "2026-05-16T09:00:00+08:00";
    const endsAt = "2026-05-16T10:00:00+08:00";
    const now = new Date("2026-05-16T08:00:00+08:00");
    const scanAt = resolveAutoSummaryFirstScanTime(startsAt, endsAt, now);
    const expectedEnd = resolveEstimatedEventEnd(startsAt, endsAt);
    expect(scanAt.getTime()).toBe(
      expectedEnd.getTime() + AUTO_SUMMARY_FIRST_SCAN_DELAY_MS
    );
  });
});
