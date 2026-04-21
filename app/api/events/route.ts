import {
  createEventWithAttendees,
  RepositoryError,
  upsertLineUser,
} from "@/lib/db/repository";
import {
  getBearerToken,
  LineAuthError,
  verifyLineAccessToken,
} from "@/lib/line/auth";
import { createMessagingClient } from "@/lib/line/messagingClient";
import {
  buildMeetingSummary,
  formatMeetingDateTime,
} from "@/lib/modules/meeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateEventRequestBody = {
  groupId?: string;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  note?: string;
  attendeeUserIds?: number[];
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

  return {
    groupId,
    title,
    date,
    time,
    location: body.location?.trim() ?? "",
    note: body.note?.trim() ?? "",
    attendeeUserIds,
  };
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
    });

    const createdEvent = await createEventWithAttendees({
      lineGroupId: input.groupId,
      createdByLineUserId: verifiedUser.lineUserId,
      title: input.title,
      description: input.note,
      location: input.location,
      startsAt: toTaipeiIso(input.date, input.time),
      attendeeUserIds: input.attendeeUserIds,
      timezone: "Asia/Taipei",
    });

    const summary = buildMeetingSummary({
      title: createdEvent.title,
      timeLabel: formatMeetingDateTime(
        createdEvent.startsAt,
        createdEvent.timezone
      ),
      location: createdEvent.location,
      note: createdEvent.description,
      attendeeNames: createdEvent.attendeeDisplayNames,
    });

    let notificationSent = true;
    try {
      const client = createMessagingClient();
      await client.pushMessage({
        to: createdEvent.lineGroupId,
        messages: [{ type: "text", text: summary }],
      });
    } catch (error) {
      notificationSent = false;
      console.error("[create-event.notify]", error);
    }

    return Response.json(
      {
        eventId: createdEvent.eventId,
        notificationSent,
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
