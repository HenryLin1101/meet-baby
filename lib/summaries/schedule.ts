/** Default meeting length when events.ends_at is not set. */
export const DEFAULT_MEETING_DURATION_MS = 60 * 60 * 1000;

/** Wait after estimated end before first Drive scan (Tactiq write delay). */
export const AUTO_SUMMARY_FIRST_SCAN_DELAY_MS = 10 * 60 * 1000;

export const AUTO_SUMMARY_RETRY_INTERVAL_MS = 10 * 60 * 1000;

export const AUTO_SUMMARY_MAX_ATTEMPTS = 6;

export function getDefaultMaxAttempts(): number {
  const raw = process.env.TACTIQ_SCAN_MAX_ATTEMPTS?.trim();
  if (!raw) return AUTO_SUMMARY_MAX_ATTEMPTS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : AUTO_SUMMARY_MAX_ATTEMPTS;
}

export function resolveEstimatedEventEnd(
  startsAt: string | Date,
  endsAt: string | Date | null | undefined
): Date {
  if (endsAt) {
    const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
    if (!Number.isNaN(end.getTime())) {
      return end;
    }
  }

  const durationMinutes = Number(process.env.TACTIQ_DEFAULT_MEETING_DURATION_MINUTES?.trim());
  const durationMs =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes * 60 * 1000
      : DEFAULT_MEETING_DURATION_MS;

  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  return new Date(start.getTime() + durationMs);
}

/**
 * First QStash scan time: estimated end + delay (or soon if already past).
 */
export function resolveAutoSummaryFirstScanTime(
  startsAt: string | Date,
  endsAt: string | Date | null | undefined,
  now = new Date()
): Date {
  const firstDelayMs = readDelayMs(
    "TACTIQ_SCAN_DELAY_AFTER_END_MINUTES",
    AUTO_SUMMARY_FIRST_SCAN_DELAY_MS
  );
  const estimatedEnd = resolveEstimatedEventEnd(startsAt, endsAt);
  const target = estimatedEnd.getTime() + firstDelayMs;
  const nowTime = now.getTime();
  if (target <= nowTime) {
    return new Date(nowTime + 5 * 1000);
  }
  return new Date(target);
}

export function resolveAutoSummaryRetryDelaySeconds(): number {
  const ms = readDelayMs(
    "TACTIQ_SCAN_RETRY_INTERVAL_MINUTES",
    AUTO_SUMMARY_RETRY_INTERVAL_MS
  );
  return Math.max(1, Math.floor(ms / 1000));
}

function readDelayMs(envKey: string, defaultMs: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return defaultMs;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 0) return defaultMs;
  return minutes * 60 * 1000;
}

/** Drive search window: from shortly before start until now (scan handler). */
export function buildTranscriptSearchWindow(
  startsAt: string | Date,
  endsAt: string | Date | null | undefined,
  now = new Date()
): { windowStart: Date; windowEnd: Date } {
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  const estimatedEnd = resolveEstimatedEventEnd(startsAt, endsAt);
  const windowStart = new Date(start.getTime() - 15 * 60 * 1000);
  const windowEnd = new Date(
    Math.max(now.getTime(), estimatedEnd.getTime() + 2 * 60 * 60 * 1000)
  );
  return { windowStart, windowEnd };
}
