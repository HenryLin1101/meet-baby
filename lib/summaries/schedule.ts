/** Used when picking transcripts for events with explicit ends_at (fallback estimate). */
export const DEFAULT_MEETING_DURATION_MS = 60 * 60 * 1000;

/** Delay after explicit end before first scan. */
export const AUTO_SUMMARY_FIRST_SCAN_DELAY_MS = 10 * 60 * 1000;

/** When no ends_at: first scan at starts_at + this offset (meeting may end early). */
export const AUTO_SUMMARY_SCAN_FROM_START_OFFSET_MS = 10 * 60 * 1000;

export const AUTO_SUMMARY_RETRY_INTERVAL_MS = 10 * 60 * 1000;

/** Stop scheduling scans after starts_at + this duration. */
export const AUTO_SUMMARY_SCAN_DEADLINE_AFTER_START_MS = 3 * 60 * 60 * 1000;

/** @deprecated Use deadline-based stopping; kept for env override compatibility. */
export const AUTO_SUMMARY_MAX_ATTEMPTS = 6;

export function hasExplicitEndsAt(
  endsAt: string | Date | null | undefined
): boolean {
  if (!endsAt) return false;
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  return !Number.isNaN(end.getTime());
}

export function resolveEstimatedEventEnd(
  startsAt: string | Date,
  endsAt: string | Date | null | undefined
): Date {
  if (hasExplicitEndsAt(endsAt)) {
    const end = endsAt instanceof Date ? endsAt : new Date(endsAt as string);
    return end;
  }

  const durationMinutes = Number(
    process.env.TACTIQ_DEFAULT_MEETING_DURATION_MINUTES?.trim()
  );
  const durationMs =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes * 60 * 1000
      : DEFAULT_MEETING_DURATION_MS;

  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  return new Date(start.getTime() + durationMs);
}

export function resolveAutoSummaryScanDeadline(
  startsAt: string | Date
): Date {
  const hours = readHoursEnv(
    "TACTIQ_SCAN_DEADLINE_AFTER_START_HOURS",
    AUTO_SUMMARY_SCAN_DEADLINE_AFTER_START_MS / (60 * 60 * 1000)
  );
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
}

export function isAutoSummaryScanPastDeadline(
  startsAt: string | Date,
  now = new Date()
): boolean {
  return now.getTime() >= resolveAutoSummaryScanDeadline(startsAt).getTime();
}

/**
 * First QStash scan:
 * - explicit ends_at → ends_at + delay (default 10 min)
 * - no ends_at → starts_at + offset (default 10 min)
 */
export function resolveAutoSummaryFirstScanTime(
  startsAt: string | Date,
  endsAt: string | Date | null | undefined,
  now = new Date()
): Date {
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  const deadline = resolveAutoSummaryScanDeadline(startsAt);

  let target: Date;
  if (hasExplicitEndsAt(endsAt)) {
    const delayMs = readDelayMs(
      "TACTIQ_SCAN_DELAY_AFTER_END_MINUTES",
      AUTO_SUMMARY_FIRST_SCAN_DELAY_MS
    );
    const end = endsAt instanceof Date ? endsAt : new Date(endsAt as string);
    target = new Date(end.getTime() + delayMs);
  } else {
    const offsetMs = readDelayMs(
      "TACTIQ_SCAN_START_OFFSET_MINUTES",
      AUTO_SUMMARY_SCAN_FROM_START_OFFSET_MS
    );
    target = new Date(start.getTime() + offsetMs);
  }

  const capped = new Date(Math.min(target.getTime(), deadline.getTime()));
  if (capped.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 5 * 1000);
  }
  return capped;
}

export function resolveAutoSummaryRetryDelaySeconds(): number {
  const ms = readDelayMs(
    "TACTIQ_SCAN_RETRY_INTERVAL_MINUTES",
    AUTO_SUMMARY_RETRY_INTERVAL_MS
  );
  return Math.max(1, Math.floor(ms / 1000));
}

/** Reference time for picking the closest transcript file. */
export function resolveTranscriptPickReferenceTime(
  startsAt: string | Date,
  endsAt: string | Date | null | undefined,
  now = new Date()
): Date {
  if (hasExplicitEndsAt(endsAt)) {
    return resolveEstimatedEventEnd(startsAt, endsAt);
  }
  return now;
}

/** Drive search window: from shortly before start until at least the scan deadline. */
export function buildTranscriptSearchWindow(
  startsAt: string | Date,
  endsAt: string | Date | null | undefined,
  now = new Date()
): { windowStart: Date; windowEnd: Date } {
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  const deadline = resolveAutoSummaryScanDeadline(startsAt);
  const windowStart = new Date(start.getTime() - 15 * 60 * 1000);
  const windowEnd = new Date(Math.max(now.getTime(), deadline.getTime()));
  return { windowStart, windowEnd };
}

export function getAutoSummaryScanDeadlineHours(): number {
  return readHoursEnv(
    "TACTIQ_SCAN_DEADLINE_AFTER_START_HOURS",
    AUTO_SUMMARY_SCAN_DEADLINE_AFTER_START_MS / (60 * 60 * 1000)
  );
}

function readDelayMs(envKey: string, defaultMs: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return defaultMs;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 0) return defaultMs;
  return minutes * 60 * 1000;
}

function readHoursEnv(envKey: string, defaultHours: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return defaultHours;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0) return defaultHours;
  return hours;
}
