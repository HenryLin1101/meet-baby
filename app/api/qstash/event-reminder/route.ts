import {
  claimEventReminder,
  getEventReminderDetails,
  markEventReminderSent,
  releaseEventReminderFailure,
  RepositoryError,
} from "@/lib/db/repository";
import { buildMeetingReminderMentionMessage } from "@/lib/line/eventNotifications";
import { createMessagingClient } from "@/lib/line/messagingClient";
import type { EventReminderJobPayload } from "@/lib/reminders/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function handleReminderRequest(request: Request) {
  let body: EventReminderJobPayload;
  try {
    body = (await request.json()) as EventReminderJobPayload;
  } catch {
    return errorResponse("請求內容不是有效 JSON。", 400);
  }

  const eventId = Number(body.eventId);
  if (!Number.isFinite(eventId)) {
    return errorResponse("缺少有效的 eventId。", 400);
  }

  try {
    const claimed = await claimEventReminder(eventId);
    if (!claimed) {
      return Response.json({ ok: true, skipped: "already-processed" });
    }

    const reminder = await getEventReminderDetails(eventId);
    if (!reminder) {
      await releaseEventReminderFailure(eventId, "找不到對應的活動資料。");
      return Response.json({ ok: true, skipped: "not-found" });
    }

    if (reminder.status !== "scheduled") {
      await releaseEventReminderFailure(eventId, `活動狀態為 ${reminder.status}，略過提醒。`);
      return Response.json({ ok: true, skipped: "not-scheduled" });
    }

    if (reminder.attendees.length === 0) {
      await releaseEventReminderFailure(eventId, "活動沒有可提醒的參與者。");
      return Response.json({ ok: true, skipped: "no-attendees" });
    }

    const client = createMessagingClient();
    await client.pushMessage({
      to: reminder.lineGroupId,
      messages: [
        buildMeetingReminderMentionMessage({
          title: reminder.title,
          startsAt: reminder.startsAt,
          timezone: reminder.timezone,
          location: reminder.location,
          note: reminder.description,
          attendees: reminder.attendees,
        }),
      ],
    });

    await markEventReminderSent(eventId);
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "提醒送出失敗。";
    try {
      await releaseEventReminderFailure(eventId, message);
    } catch (releaseError) {
      console.error("[event-reminder.release]", releaseError);
    }

    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }

    console.error("[event-reminder]", error);
    return errorResponse("提醒送出失敗。", 500);
  }
}

export async function POST(request: Request) {
  const { verifySignatureAppRouter } = await import("@upstash/qstash/nextjs");
  return verifySignatureAppRouter(handleReminderRequest)(request);
}
