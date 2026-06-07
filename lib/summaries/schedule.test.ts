import { describe, expect, it } from "vitest";
import {
  AUTO_SUMMARY_FIRST_SCAN_DELAY_MS,
  AUTO_SUMMARY_SCAN_FROM_START_OFFSET_MS,
  buildTranscriptSearchWindow,
  isAutoSummaryScanPastDeadline,
  resolveAutoSummaryFirstScanTime,
  resolveAutoSummaryScanDeadline,
  resolveEstimatedEventEnd,
  resolveTranscriptPickReferenceTime,
} from "@/lib/summaries/schedule";

describe("summaries/schedule", () => {
  it("uses ends_at when provided", () => {
    const end = resolveEstimatedEventEnd(
      "2026-05-16T09:00:00+08:00",
      "2026-05-16T10:30:00+08:00"
    );
    expect(end.toISOString()).toBe("2026-05-16T02:30:00.000Z");
  });

  it("schedules first scan at ends_at + delay when ends_at is set", () => {
    const startsAt = "2026-05-16T09:00:00+08:00";
    const endsAt = "2026-05-16T10:00:00+08:00";
    const now = new Date("2026-05-16T08:00:00+08:00");
    const scanAt = resolveAutoSummaryFirstScanTime(startsAt, endsAt, now);
    const expectedEnd = resolveEstimatedEventEnd(startsAt, endsAt);
    expect(scanAt.getTime()).toBe(
      expectedEnd.getTime() + AUTO_SUMMARY_FIRST_SCAN_DELAY_MS
    );
  });

  it("schedules first scan at starts_at + 10min when ends_at is missing", () => {
    const startsAt = "2026-05-16T09:00:00+08:00";
    const now = new Date("2026-05-16T08:00:00+08:00");
    const scanAt = resolveAutoSummaryFirstScanTime(startsAt, null, now);
    const start = new Date(startsAt);
    expect(scanAt.getTime()).toBe(
      start.getTime() + AUTO_SUMMARY_SCAN_FROM_START_OFFSET_MS
    );
  });

  it("scan deadline is starts_at + 3 hours", () => {
    const startsAt = "2026-05-16T09:00:00+08:00";
    const start = new Date(startsAt);
    const deadline = resolveAutoSummaryScanDeadline(startsAt);
    expect(deadline.getTime() - start.getTime()).toBe(3 * 60 * 60 * 1000);
  });

  it("detects past deadline", () => {
    const startsAt = "2026-05-16T09:00:00+08:00";
    const now = new Date("2026-05-16T13:00:00+08:00");
    expect(isAutoSummaryScanPastDeadline(startsAt, now)).toBe(true);
  });

  it("uses now as pick reference when ends_at is missing", () => {
    const now = new Date("2026-05-16T11:00:00+08:00");
    const ref = resolveTranscriptPickReferenceTime(
      "2026-05-16T09:00:00+08:00",
      null,
      now
    );
    expect(ref.getTime()).toBe(now.getTime());
  });

  it("search window end reaches at least the scan deadline", () => {
    const startsAt = "2026-05-16T09:00:00+08:00";
    const now = new Date("2026-05-16T09:30:00+08:00");
    const { windowEnd } = buildTranscriptSearchWindow(startsAt, null, now);
    const deadline = resolveAutoSummaryScanDeadline(startsAt);
    expect(windowEnd.getTime()).toBeGreaterThanOrEqual(deadline.getTime());
  });
});
