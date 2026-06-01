import {
  createEventWithAttendees,
  getGoogleCredentialByLineUserId,
  hasCalendarScope,
  setEventAutoSummarySchedule,
  setEventReminderSchedule,
  listGroupEvents,
  listLineUsersByIds,
  markGoogleCredentialRevoked,
  RepositoryError,
  updateEventCalendarData,
  upsertLineUser,
  getGroupDriveFolderId,
  getGroupName,
  setEventDriveFolderId,
  upsertGroupDriveFolderId,
} from "@/lib/db/repository";
import {
  createDriveFolder,
  setDriveFolderPermission,
  formatMeetingFolderName,
} from "@/lib/google/driveAdmin";
import {
  getBearerToken,
  LineAuthError,
  verifyLineAccessToken,
} from "@/lib/line/auth";
import { createCalendarEventWithMeet } from "@/lib/google/calendar";
import { GoogleRefreshTokenInvalidError, refreshAccessToken } from "@/lib/google/oauth";
import {
  buildMeetingCreatedMentionMessage,
  buildRecurringMeetingCreatedMessage,
} from "@/lib/line/eventNotifications";
import { createMessagingClient } from "@/lib/line/messagingClient";
import {
  buildMeetingSummary,
  formatMeetingDateTime,
} from "@/lib/modules/meeting";
import { publishEventReminder } from "@/lib/reminders/qstash";
import { publishTactiqScanJob } from "@/lib/summaries/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEKDAY_NAMES_ZH = ["日", "一", "二", "三", "四", "五", "六"];

// Calendar/Meet integration is best-effort. If Google rejects the token as
// expired/revoked, drop the dead credential so the next meeting-form load
// (calendar-scope check) re-prompts the user for consent.
async function revokeCredentialIfReauthNeeded(
  err: unknown,
  lineUserId: string
): Promise<void> {
  if (!(err instanceof GoogleRefreshTokenInvalidError)) return;
  try {
    await markGoogleCredentialRevoked(lineUserId);
  } catch (revokeErr) {
    console.error("[create-event.calendar.revoke]", revokeErr);
  }
}

type RecurrenceInput = {
  weekdays: number[];
  endDate: string;
};

type CreateEventRequestBody = {
  groupId?: string;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  note?: string;
  attendeeUserIds?: number[];
  wantsMeetingLink?: boolean;
  reminderLeadTimeMinutes?: number;
  recurrence?: RecurrenceInput;
  allowOthersToModify?: boolean;
};

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function toTaipeiIso(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

function parseBody(body: CreateEventRequestBody) {
  const title = body.title?.trim();
  const groupId = body.groupId?.trim();
  const date = body.date?.trim();
  const time = body.time?.trim();
  const attendeeUserIds = Array.isArray(body.attendeeUserIds)
    ? body.attendeeUserIds.map(Number).filter(Number.isFinite)
    : [];

  if (!groupId) {
    throw new RepositoryError("缺少 groupId。", 400, "INVALID_INPUT");
  }
  if (!title) {
    throw new RepositoryError("會議主題不可為空。", 400, "INVALID_INPUT");
  }
  if (!date || !time) {
    throw new RepositoryError("請提供完整的日期與時間。", 400, "INVALID_INPUT");
  }

  const rawLead = Number(body.reminderLeadTimeMinutes);
  const reminderLeadTimeMinutes =
    Number.isFinite(rawLead) && rawLead >= 1
      ? Math.min(Math.round(rawLead), 10080)
      : 5;

  let recurrence: RecurrenceInput | undefined;
  if (body.recurrence) {
    const { weekdays, endDate } = body.recurrence;
    if (
      !Array.isArray(weekdays) ||
      weekdays.length === 0 ||
      !weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    ) {
      throw new RepositoryError("重複設定的星期格式不正確。", 400, "INVALID_INPUT");
    }
    if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new RepositoryError("重複結束日期格式不正確。", 400, "INVALID_INPUT");
    }
    if (endDate < date) {
      throw new RepositoryError("重複結束日期不能早於開始日期。", 400, "INVALID_INPUT");
    }
    recurrence = { weekdays, endDate };
  }

  return {
    groupId,
    title,
    date,
    time,
    location: body.location?.trim() ?? "",
    note: body.note?.trim() ?? "",
    attendeeUserIds,
    wantsMeetingLink: body.wantsMeetingLink !== false,
    reminderLeadTimeMinutes,
    recurrence,
    // Default true; only pass false through when the client explicitly opts out.
    allowOthersToModify: body.allowOthersToModify !== false,
  };
}

function generateRecurrenceDates(
  startDate: string,
  weekdays: number[],
  endDate: string
): string[] {
  const dates: string[] = [];
  const weekdaySet = new Set(weekdays);
  const cursor = new Date(`${startDate}T00:00:00+08:00`);
  const end = new Date(`${endDate}T00:00:00+08:00`);

  while (cursor <= end && dates.length < 52) {
    if (weekdaySet.has(cursor.getDay())) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

async function createSingleEvent(
  input: ReturnType<typeof parseBody>,
  verifiedUserId: string,
  date: string,
  parentFolderId: string | null
): Promise<{
  createdEvent: Awaited<ReturnType<typeof createEventWithAttendees>>;
  meetingUrl: string | null;
  driveFolderUrl: string | null;
  updatedParentFolderId: string | null;
}> {
  const createdEvent = await createEventWithAttendees({
    lineGroupId: input.groupId,
    createdByLineUserId: verifiedUserId,
    title: input.title,
    description: input.note,
    location: input.location,
    startsAt: toTaipeiIso(date, input.time),
    attendeeUserIds: input.attendeeUserIds,
    timezone: "Asia/Taipei",
    reminderLeadTimeMinutes: input.reminderLeadTimeMinutes,
    allowOthersToModify: input.allowOthersToModify,
  });

  let meetingUrl: string | null = null;
  if (input.wantsMeetingLink) {
    try {
      const credential = await getGoogleCredentialByLineUserId(verifiedUserId);
      if (credential && hasCalendarScope(credential)) {
        const { accessToken } = await refreshAccessToken(credential.refreshToken);
        const attendeeLineUsers = await listLineUsersByIds(input.attendeeUserIds);
        const attendeeEmails = attendeeLineUsers
          .map((u) => u.email)
          .filter((e): e is string => Boolean(e));
        const calResult = await createCalendarEventWithMeet({
          accessToken,
          title: createdEvent.title,
          startsAt: createdEvent.startsAt,
          location: createdEvent.location,
          description: createdEvent.description,
          attendeeEmails,
        });
        meetingUrl = calResult.meetingUrl;
        try {
          await updateEventCalendarData({
            eventId: createdEvent.eventId,
            meetingUrl: calResult.meetingUrl,
            calendarEventId: calResult.calendarEventId,
          });
        } catch (dbErr) {
          console.error("[create-event.calendar.persist]", dbErr);
        }
      }
    } catch (err) {
      console.error("[create-event.calendar]", err);
      await revokeCredentialIfReauthNeeded(err, verifiedUserId);
    }
  }

  let driveFolderUrl: string | null = null;
  let updatedParentFolderId = parentFolderId;
  try {
    let currentParentFolderId = parentFolderId;
    if (!currentParentFolderId) {
      const groupFolder = await createDriveFolder({ name: "LINE 群組" });
      await setDriveFolderPermission({ folderId: groupFolder.id, role: "writer" });
      await upsertGroupDriveFolderId(input.groupId, groupFolder.id);
      currentParentFolderId = groupFolder.id;
      updatedParentFolderId = groupFolder.id;
    }
    const folderName = formatMeetingFolderName(createdEvent.title, createdEvent.startsAt);
    const meetingFolder = await createDriveFolder({
      name: folderName,
      parentId: currentParentFolderId,
    });
    await setDriveFolderPermission({ folderId: meetingFolder.id, role: "writer" });
    await setEventDriveFolderId(createdEvent.eventId, meetingFolder.id);
    driveFolderUrl = meetingFolder.webViewLink;
  } catch (error) {
    console.error("[create-event.drive-folder]", error);
  }

  try {
    const reminder = await publishEventReminder({
      eventId: createdEvent.eventId,
      startsAt: createdEvent.startsAt,
      leadTimeMinutes: input.reminderLeadTimeMinutes,
    });
    if (reminder) {
      await setEventReminderSchedule({
        eventId: createdEvent.eventId,
        messageId: reminder.messageId,
        scheduledAt: reminder.scheduledAt,
      });
    }
  } catch (error) {
    console.error("[create-event.schedule-reminder]", error);
  }

  try {
    const scan = await publishTactiqScanJob({
      eventId: createdEvent.eventId,
      attempt: 1,
      startsAt: createdEvent.startsAt,
      endsAt: createdEvent.endsAt,
    });
    await setEventAutoSummarySchedule({
      eventId: createdEvent.eventId,
      messageId: scan.messageId,
      scheduledAt: scan.scheduledAt,
    });
  } catch (error) {
    console.error("[create-event.schedule-auto-summary]", error);
  }

  return { createdEvent, meetingUrl, driveFolderUrl, updatedParentFolderId };
}

export async function POST(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return errorResponse("缺少 LINE access token。", 401);
  }

  let body: CreateEventRequestBody;
  try {
    body = (await request.json()) as CreateEventRequestBody;
  } catch {
    return errorResponse("請求內容不是有效 JSON。", 400);
  }

  try {
    const verifiedUser = await verifyLineAccessToken(accessToken);
    const input = parseBody(body);

    await upsertLineUser({
      lineUserId: verifiedUser.lineUserId,
      displayName: verifiedUser.displayName,
      pictureUrl: verifiedUser.pictureUrl,
      statusMessage: verifiedUser.statusMessage,
      email: verifiedUser.email,
    });

    // ── Recurring meeting path ──────────────────────────────────────────────
    if (input.recurrence) {
      const { weekdays, endDate } = input.recurrence;
      const dates = generateRecurrenceDates(input.date, weekdays, endDate);

      if (dates.length === 0) {
        return errorResponse("所選星期在結束日期前沒有任何符合的日期。", 400);
      }

      let parentFolderId = await getGroupDriveFolderId(input.groupId);
      const attendeeLineUsers = await listLineUsersByIds(input.attendeeUserIds);
      const eventIds: number[] = [];

      for (const date of dates) {
        try {
          const result = await createSingleEvent(
            input,
            verifiedUser.lineUserId,
            date,
            parentFolderId
          );
          parentFolderId = result.updatedParentFolderId;
          eventIds.push(result.createdEvent.eventId);
        } catch (err) {
          console.error(`[create-recurring-event.date=${date}]`, err);
        }
      }

      let notificationSent = true;
      try {
        const client = createMessagingClient();
        const weekdayNames = weekdays.sort().map((d) => WEEKDAY_NAMES_ZH[d]);
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];

        await client.pushMessage({
          to: input.groupId,
          messages: [
            attendeeLineUsers.length > 0
              ? buildRecurringMeetingCreatedMessage({
                  title: input.title,
                  time: input.time,
                  weekdayNames,
                  firstDate,
                  lastDate,
                  count: dates.length,
                  attendees: attendeeLineUsers,
                  note: input.note || null,
                })
              : {
                  type: "text" as const,
                  text: `【重複會議預約】\n主題：${input.title}\n時間：每週 ${weekdays.sort().map((d) => WEEKDAY_NAMES_ZH[d]).join("、")} ${input.time}\n共 ${dates.length} 場（${dates[0]} 至 ${dates[dates.length - 1]}）`,
                },
          ],
        });
      } catch (error) {
        notificationSent = false;
        console.error("[create-recurring-event.notify]", error);
      }

      return Response.json(
        {
          eventIds,
          count: eventIds.length,
          notificationSent,
        },
        { status: 201 }
      );
    }

    // ── Single meeting path (unchanged behaviour) ───────────────────────────
    const createdEvent = await createEventWithAttendees({
      lineGroupId: input.groupId,
      createdByLineUserId: verifiedUser.lineUserId,
      title: input.title,
      description: input.note,
      location: input.location,
      startsAt: toTaipeiIso(input.date, input.time),
      attendeeUserIds: input.attendeeUserIds,
      timezone: "Asia/Taipei",
      reminderLeadTimeMinutes: input.reminderLeadTimeMinutes,
    });
    const attendeeLineUsers = await listLineUsersByIds(input.attendeeUserIds);

    let meetingUrl: string | null = null;
    if (input.wantsMeetingLink) {
      try {
      const credential = await getGoogleCredentialByLineUserId(verifiedUser.lineUserId);
      if (credential && hasCalendarScope(credential)) {
        const { accessToken } = await refreshAccessToken(credential.refreshToken);
        const attendeeEmails = attendeeLineUsers
          .map((user) => user.email)
          .filter((email): email is string => Boolean(email));
        const calResult = await createCalendarEventWithMeet({
          accessToken,
          title: createdEvent.title,
          startsAt: createdEvent.startsAt,
          location: createdEvent.location,
          description: createdEvent.description,
          attendeeEmails,
        });
        meetingUrl = calResult.meetingUrl;
        try {
          await updateEventCalendarData({
            eventId: createdEvent.eventId,
            meetingUrl: calResult.meetingUrl,
            calendarEventId: calResult.calendarEventId,
          });
        } catch (dbErr) {
          console.error("[create-event.calendar.persist]", dbErr);
        }
      }
    } catch (err) {
      console.error("[create-event.calendar]", err);
      await revokeCredentialIfReauthNeeded(err, verifiedUser.lineUserId);
    }
    }

    let driveFolderUrl: string | null = null;
    try {
      let parentFolderId = await getGroupDriveFolderId(input.groupId);

      if (!parentFolderId) {
        const groupName = await getGroupName(input.groupId);
        const groupFolder = await createDriveFolder({ name: groupName ?? "LINE 群組" });
        await setDriveFolderPermission({
          folderId: groupFolder.id,
          role: "writer",
        });
        await upsertGroupDriveFolderId(input.groupId, groupFolder.id);
        parentFolderId = groupFolder.id;
      }

      const folderName = formatMeetingFolderName(
        createdEvent.title,
        createdEvent.startsAt
      );
      const meetingFolder = await createDriveFolder({
        name: folderName,
        parentId: parentFolderId,
      });
      await setDriveFolderPermission({
        folderId: meetingFolder.id,
        role: "writer",
      });
      await setEventDriveFolderId(createdEvent.eventId, meetingFolder.id);
      driveFolderUrl = meetingFolder.webViewLink;
    } catch (error) {
      console.error("[create-event.drive-folder]", error);
    }

    let notificationSent = true;
    try {
      const client = createMessagingClient();
      await client.pushMessage({
        to: createdEvent.lineGroupId,
        messages:
          attendeeLineUsers.length > 0
            ? [
                buildMeetingCreatedMentionMessage({
                  title: createdEvent.title,
                  startsAt: createdEvent.startsAt,
                  timezone: createdEvent.timezone,
                  location: createdEvent.location,
                  note: createdEvent.description,
                  meetingUrl,
                  driveFolderUrl,
                  attendees: attendeeLineUsers,
                }),
              ]
            : [
                {
                  type: "text" as const,
                  text: buildMeetingSummary({
                    title: createdEvent.title,
                    timeLabel: formatMeetingDateTime(
                      createdEvent.startsAt,
                      createdEvent.timezone
                    ),
                    location: createdEvent.location,
                    note: createdEvent.description,
                    attendeeNames: createdEvent.attendeeDisplayNames,
                    driveFolderUrl,
                  }),
                },
              ],
      });
    } catch (error) {
      notificationSent = false;
      console.error("[create-event.notify]", error);
    }

    let reminderScheduled = true;
    try {
      const reminder = await publishEventReminder({
        eventId: createdEvent.eventId,
        startsAt: createdEvent.startsAt,
        leadTimeMinutes: input.reminderLeadTimeMinutes,
      });
      if (reminder) {
        await setEventReminderSchedule({
          eventId: createdEvent.eventId,
          messageId: reminder.messageId,
          scheduledAt: reminder.scheduledAt,
        });
      }
    } catch (error) {
      reminderScheduled = false;
      console.error("[create-event.schedule-reminder]", error);
    }

    let autoSummaryScheduled = true;
    try {
      const scan = await publishTactiqScanJob({
        eventId: createdEvent.eventId,
        attempt: 1,
        startsAt: createdEvent.startsAt,
        endsAt: createdEvent.endsAt,
      });
      await setEventAutoSummarySchedule({
        eventId: createdEvent.eventId,
        messageId: scan.messageId,
        scheduledAt: scan.scheduledAt,
      });
    } catch (error) {
      autoSummaryScheduled = false;
      console.error("[create-event.schedule-auto-summary]", error);
    }

    return Response.json(
      {
        eventId: createdEvent.eventId,
        meetingUrl,
        notificationSent,
        reminderScheduled,
        autoSummaryScheduled,
        driveFolderUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }

    console.error("[create-event]", error);
    return errorResponse("建立活動失敗。", 500);
  }
}

export async function GET(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return errorResponse("缺少 LINE access token。", 401);
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId")?.trim();
  if (!groupId) {
    return errorResponse("缺少 groupId。", 400);
  }

  try {
    const verifiedUser = await verifyLineAccessToken(accessToken);
    await upsertLineUser({
      lineUserId: verifiedUser.lineUserId,
      displayName: verifiedUser.displayName,
      pictureUrl: verifiedUser.pictureUrl,
      statusMessage: verifiedUser.statusMessage,
      email: verifiedUser.email,
    });

    const events = await listGroupEvents(groupId);

    return Response.json({
      events,
      currentLineUserId: verifiedUser.lineUserId,
    });
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }

    console.error("[list-events]", error);
    return errorResponse("讀取活動失敗。", 500);
  }
}
