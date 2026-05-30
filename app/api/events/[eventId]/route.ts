import {
  cancelEventForUser,
  getGoogleCredentialByLineUserId,
  hasCalendarScope,
  markGoogleCredentialRevoked,
  RepositoryError,
  setEventAutoSummarySchedule,
  setEventReminderSchedule,
  updateEventForUser,
  upsertLineUser,
} from "@/lib/db/repository";
import {
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/lib/google/calendar";
import { GoogleRefreshTokenInvalidError, refreshAccessToken } from "@/lib/google/oauth";
import {
  getBearerToken,
  LineAuthError,
  verifyLineAccessToken,
} from "@/lib/line/auth";
import { buildMeetingCancelledMessage } from "@/lib/line/eventNotifications";
import { createMessagingClient } from "@/lib/line/messagingClient";
import { cancelEventReminder, publishEventReminder } from "@/lib/reminders/qstash";
import { cancelTactiqScanJob, publishTactiqScanJob } from "@/lib/summaries/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Calendar sync is best-effort. If Google rejects the token as expired/revoked,
// drop the dead credential so the next meeting-form load re-prompts for consent.
async function revokeCredentialIfReauthNeeded(
  err: unknown,
  lineUserId: string
): Promise<void> {
  if (!(err instanceof GoogleRefreshTokenInvalidError)) return;
  try {
    await markGoogleCredentialRevoked(lineUserId);
  } catch (revokeErr) {
    console.error("[event.calendar.revoke]", revokeErr);
  }
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function parseEventId(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new RepositoryError("eventId 格式不正確。", 400, "INVALID_INPUT");
  }
  return parsed;
}

type PatchBody = {
  title?: string;
  date?: string;
  time?: string;
  location?: string | null;
  description?: string | null;
  allowOthersToModify?: boolean;
};

function toTaipeiIso(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) return errorResponse("缺少 LINE access token。", 401);

  try {
    const { eventId: rawId } = await params;
    const eventId = parseEventId(rawId);
    const verifiedUser = await verifyLineAccessToken(accessToken);
    await upsertLineUser({
      lineUserId: verifiedUser.lineUserId,
      displayName: verifiedUser.displayName,
      pictureUrl: verifiedUser.pictureUrl,
      statusMessage: verifiedUser.statusMessage,
      email: verifiedUser.email,
    });

    const context = await cancelEventForUser({
      eventId,
      requesterLineUserId: verifiedUser.lineUserId,
    });

    // Best-effort cleanup of scheduled side-effects.
    if (context.reminderMessageId) {
      try {
        await cancelEventReminder(context.reminderMessageId);
      } catch (err) {
        console.error("[cancel-event.reminder]", err);
      }
    }
    if (context.autoSummaryMessageId) {
      try {
        await cancelTactiqScanJob(context.autoSummaryMessageId);
      } catch (err) {
        console.error("[cancel-event.auto-summary]", err);
      }
    }

    if (context.calendarEventId && context.creatorLineUserId) {
      try {
        const credential = await getGoogleCredentialByLineUserId(
          context.creatorLineUserId
        );
        if (credential && hasCalendarScope(credential)) {
          const { accessToken: googleAccessToken } = await refreshAccessToken(
            credential.refreshToken
          );
          await deleteCalendarEvent({
            accessToken: googleAccessToken,
            calendarEventId: context.calendarEventId,
          });
        }
      } catch (err) {
        console.error("[cancel-event.calendar]", err);
        await revokeCredentialIfReauthNeeded(err, context.creatorLineUserId);
      }
    }

    try {
      const client = createMessagingClient();
      await client.pushMessage({
        to: context.lineGroupId,
        messages: [
          buildMeetingCancelledMessage({
            title: context.title,
            startsAt: context.startsAt,
            timezone: context.timezone,
            cancelledBy: verifiedUser.displayName ?? null,
          }),
        ],
      });
    } catch (err) {
      console.error("[cancel-event.notify]", err);
    }

    return Response.json({ eventId: context.eventId, status: "cancelled" });
  } catch (error) {
    if (error instanceof LineAuthError) return errorResponse(error.message, error.status);
    if (error instanceof RepositoryError) return errorResponse(error.message, error.status);
    console.error("[cancel-event]", error);
    return errorResponse("取消活動失敗。", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) return errorResponse("缺少 LINE access token。", 401);

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return errorResponse("請求內容不是有效 JSON。", 400);
  }

  try {
    const { eventId: rawId } = await params;
    const eventId = parseEventId(rawId);
    const verifiedUser = await verifyLineAccessToken(accessToken);
    await upsertLineUser({
      lineUserId: verifiedUser.lineUserId,
      displayName: verifiedUser.displayName,
      pictureUrl: verifiedUser.pictureUrl,
      statusMessage: verifiedUser.statusMessage,
      email: verifiedUser.email,
    });

    const fields: {
      title?: string;
      startsAt?: string;
      location?: string | null;
      description?: string | null;
      allowOthersToModify?: boolean;
    } = {};

    if (body.title !== undefined) fields.title = body.title;
    if (body.location !== undefined) fields.location = body.location;
    if (body.description !== undefined) fields.description = body.description;
    if (body.allowOthersToModify !== undefined) {
      fields.allowOthersToModify = Boolean(body.allowOthersToModify);
    }

    if (body.date !== undefined || body.time !== undefined) {
      if (!body.date || !body.time) {
        return errorResponse("變更時間需同時提供 date 與 time。", 400);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return errorResponse("date 格式應為 YYYY-MM-DD。", 400);
      }
      if (!/^\d{2}:\d{2}$/.test(body.time)) {
        return errorResponse("time 格式應為 HH:MM。", 400);
      }
      fields.startsAt = toTaipeiIso(body.date, body.time);
    }

    const { previous, next, timeChanged } = await updateEventForUser({
      eventId,
      requesterLineUserId: verifiedUser.lineUserId,
      fields,
    });

    // If time changed: reschedule reminder + auto-summary.
    if (timeChanged) {
      if (previous.reminderMessageId) {
        try {
          await cancelEventReminder(previous.reminderMessageId);
        } catch (err) {
          console.error("[update-event.reminder.cancel]", err);
        }
      }
      try {
        const reminder = await publishEventReminder({
          eventId: next.eventId,
          startsAt: next.startsAt,
          leadTimeMinutes: next.reminderLeadTimeMinutes,
        });
        if (reminder) {
          await setEventReminderSchedule({
            eventId: next.eventId,
            messageId: reminder.messageId,
            scheduledAt: reminder.scheduledAt,
          });
        }
      } catch (err) {
        console.error("[update-event.reminder.publish]", err);
      }

      if (previous.autoSummaryMessageId) {
        try {
          await cancelTactiqScanJob(previous.autoSummaryMessageId);
        } catch (err) {
          console.error("[update-event.auto-summary.cancel]", err);
        }
      }
      try {
        const scan = await publishTactiqScanJob({
          eventId: next.eventId,
          attempt: 1,
          startsAt: next.startsAt,
        });
        await setEventAutoSummarySchedule({
          eventId: next.eventId,
          messageId: scan.messageId,
          scheduledAt: scan.scheduledAt,
        });
      } catch (err) {
        console.error("[update-event.auto-summary.publish]", err);
      }
    }

    // Mirror changes to Google Calendar (best-effort).
    if (next.calendarEventId && next.creatorLineUserId) {
      try {
        const credential = await getGoogleCredentialByLineUserId(
          next.creatorLineUserId
        );
        if (credential && hasCalendarScope(credential)) {
          const { accessToken: googleAccessToken } = await refreshAccessToken(
            credential.refreshToken
          );
          await updateCalendarEvent({
            accessToken: googleAccessToken,
            calendarEventId: next.calendarEventId,
            title: body.title !== undefined ? next.title : undefined,
            startsAt: timeChanged ? next.startsAt : undefined,
            location: body.location !== undefined ? next.location : undefined,
            description: body.description !== undefined ? next.description : undefined,
          });
        }
      } catch (err) {
        console.error("[update-event.calendar]", err);
        await revokeCredentialIfReauthNeeded(err, next.creatorLineUserId);
      }
    }

    return Response.json({
      eventId: next.eventId,
      title: next.title,
      startsAt: next.startsAt,
      location: next.location,
      description: next.description,
      meetingUrl: next.meetingUrl,
      timezone: next.timezone,
      allowOthersToModify: next.allowOthersToModify,
      isOwner: next.requesterIsCreator,
    });
  } catch (error) {
    if (error instanceof LineAuthError) return errorResponse(error.message, error.status);
    if (error instanceof RepositoryError) return errorResponse(error.message, error.status);
    console.error("[update-event]", error);
    return errorResponse("更新活動失敗。", 500);
  }
}
