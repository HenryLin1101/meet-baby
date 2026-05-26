import { refreshAccessToken } from "@/lib/google/oauth";

export const GOOGLE_CALENDAR_EVENTS_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

type GoogleApiErrorPayload =
  | {
      error?: {
        message?: string;
        status?: string;
        code?: number;
        errors?: Array<{ message?: string; reason?: string }>;
      };
    }
  | { error?: string };

function formatGoogleApiError(status: number, payload: unknown): string {
  const p = payload as GoogleApiErrorPayload | null;
  const messageFromString =
    typeof (p as { error?: unknown } | null)?.error === "string"
      ? String((p as { error?: string }).error)
      : null;
  if (messageFromString) {
    return `Google API error (${status}): ${messageFromString}`;
  }

  const nested = (p as { error?: unknown } | null)?.error as
    | { message?: unknown; status?: unknown; errors?: unknown }
    | null;

  const message =
    typeof nested?.message === "string" ? String(nested.message) : null;
  const statusText =
    typeof nested?.status === "string" ? String(nested.status) : null;
  const reason =
    Array.isArray(nested?.errors) &&
    typeof (nested.errors[0] as { reason?: unknown } | null)?.reason ===
      "string"
      ? String((nested.errors[0] as { reason: string }).reason)
      : null;

  const parts = [
    message,
    reason ? `reason=${reason}` : null,
    statusText ? `status=${statusText}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  return parts
    ? `Google API error (${status}): ${parts}`
    : `Google API error (${status})`;
}

async function googleFetchJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    throw new Error(formatGoogleApiError(response.status, json));
  }
  if (!json) {
    throw new Error("Google API returned empty JSON.");
  }
  return json;
}

type CalendarEventResponse = {
  id?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
};

export async function createCalendarEventWithMeet(input: {
  accessToken: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  description?: string | null;
  attendeeEmails?: string[];
}): Promise<{ calendarEventId: string; meetingUrl: string }> {
  const startsAtDate = new Date(input.startsAt);
  if (Number.isNaN(startsAtDate.getTime())) {
    throw new Error("startsAt 格式不正確。");
  }

  const endsAtDate = input.endsAt
    ? new Date(input.endsAt)
    : new Date(startsAtDate.getTime() + 60 * 60 * 1000);

  const body: Record<string, unknown> = {
    summary: input.title,
    start: { dateTime: startsAtDate.toISOString(), timeZone: "Asia/Taipei" },
    end: { dateTime: endsAtDate.toISOString(), timeZone: "Asia/Taipei" },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  if (input.location?.trim()) {
    body.location = input.location.trim();
  }
  if (input.description?.trim()) {
    body.description = input.description.trim();
  }
  const attendees = (input.attendeeEmails ?? [])
    .map((email) => email?.trim())
    .filter((email): email is string => Boolean(email))
    .map((email) => ({ email }));
  if (attendees.length > 0) {
    body.attendees = attendees;
  }

  const event = await googleFetchJson<CalendarEventResponse>(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    input.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const calendarEventId = event.id?.trim();
  if (!calendarEventId) {
    throw new Error("Google Calendar API 未回傳 event id。");
  }

  const videoEntry = event.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video"
  );
  const meetingUrl = videoEntry?.uri?.trim();
  if (!meetingUrl) {
    throw new Error("Google Calendar API 未回傳 Meet 連結。");
  }

  return { calendarEventId, meetingUrl };
}

export async function deleteCalendarEvent(input: {
  accessToken: string;
  calendarEventId: string;
}): Promise<void> {
  const id = input.calendarEventId.trim();
  if (!id) return;
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${input.accessToken}` },
      cache: "no-store",
    }
  );
  // 410 Gone = already deleted; 404 = not found — both are fine for our cleanup intent.
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const json = (await response.json().catch(() => null)) as unknown;
    throw new Error(formatGoogleApiError(response.status, json));
  }
}

export async function updateCalendarEvent(input: {
  accessToken: string;
  calendarEventId: string;
  title?: string;
  startsAt?: string;
  endsAt?: string | null;
  location?: string | null;
  description?: string | null;
}): Promise<void> {
  const id = input.calendarEventId.trim();
  if (!id) return;

  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.summary = input.title;
  if (input.location !== undefined) body.location = input.location ?? "";
  if (input.description !== undefined) body.description = input.description ?? "";

  if (input.startsAt !== undefined) {
    const startsAtDate = new Date(input.startsAt);
    if (Number.isNaN(startsAtDate.getTime())) {
      throw new Error("startsAt 格式不正確。");
    }
    body.start = { dateTime: startsAtDate.toISOString(), timeZone: "Asia/Taipei" };
    const endsAtDate = input.endsAt
      ? new Date(input.endsAt)
      : new Date(startsAtDate.getTime() + 60 * 60 * 1000);
    body.end = { dateTime: endsAtDate.toISOString(), timeZone: "Asia/Taipei" };
  } else if (input.endsAt !== undefined && input.endsAt !== null) {
    const endsAtDate = new Date(input.endsAt);
    if (!Number.isNaN(endsAtDate.getTime())) {
      body.end = { dateTime: endsAtDate.toISOString(), timeZone: "Asia/Taipei" };
    }
  }

  if (Object.keys(body).length === 0) return;

  await googleFetchJson<CalendarEventResponse>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`,
    input.accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

export async function createCalendarEventWithMeetByRefreshToken(input: {
  refreshToken: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  description?: string | null;
}): Promise<{ calendarEventId: string; meetingUrl: string }> {
  const { accessToken } = await refreshAccessToken(input.refreshToken);
  return createCalendarEventWithMeet({ ...input, accessToken });
}
