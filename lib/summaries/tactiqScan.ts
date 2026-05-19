import {
  getEventAutoSummaryDetails,
  getGoogleCredentialByLineUserId,
  getProcessedDriveFileIds,
  hasActiveSummaryForEvent,
  incrementEventAutoSummaryAttempt,
  markEventAutoSummaryCompleted,
  markEventAutoSummaryFailed,
} from "@/lib/db/repository";
import {
  listTactiqTranscripts,
  pickBestTranscript,
} from "@/lib/google/driveTranscript";
import { createMessagingClient } from "@/lib/line/messagingClient";
import {
  buildTranscriptSearchWindow,
  getAutoSummaryScanDeadlineHours,
  isAutoSummaryScanPastDeadline,
  resolveAutoSummaryRetryDelaySeconds,
  resolveTranscriptPickReferenceTime,
} from "@/lib/summaries/schedule";
import { startSummaryFromDriveFile } from "@/lib/summaries/startSummary";
import { publishTactiqScanJob } from "@/lib/summaries/qstash";

export type TactiqScanResult =
  | { status: "started"; summaryId: number; fileId: string }
  | { status: "retry_scheduled"; attempt: number; nextAttempt: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; message: string };

function resolveHostLineUserId(
  createdByLineUserId: string
): string {
  const override = process.env.TACTIQ_HOST_LINE_USER_ID?.trim();
  return override || createdByLineUserId;
}

export async function runTactiqScanForEvent(input: {
  eventId: number;
  attempt?: number;
}): Promise<TactiqScanResult> {
  const eventId = input.eventId;
  const attempt = Math.max(1, input.attempt ?? 1);

  const event = await getEventAutoSummaryDetails(eventId);
  if (!event) {
    return { status: "skipped", reason: "event-not-found" };
  }

  if (event.autoSummaryCompletedAt) {
    return { status: "skipped", reason: "already-completed" };
  }

  if (event.status !== "scheduled") {
    return { status: "skipped", reason: `event-status-${event.status}` };
  }

  if (await hasActiveSummaryForEvent(eventId)) {
    await markEventAutoSummaryCompleted(eventId);
    return { status: "skipped", reason: "summary-already-active" };
  }

  const hostLineUserId = resolveHostLineUserId(event.createdByLineUserId);
  const credential = await getGoogleCredentialByLineUserId(hostLineUserId);
  if (!credential) {
    const message = "missing_google_credential";
    await markEventAutoSummaryFailed(eventId, message);
    try {
      const client = createMessagingClient();
      await client.pushMessage({
        to: event.lineGroupId,
        messages: [
          {
            type: "text",
            text: [
              "【自動會議摘要】",
              "找不到主持人的 Google Drive 授權，無法讀取 Tactiq 逐字稿。",
              "請主持人完成 Google 授權後，在群組輸入「掃描逐字稿」重試。",
            ].join("\n"),
          },
        ],
      });
    } catch (pushErr) {
      console.error("[tactiq-scan.notify-missing-credential]", pushErr);
    }
    return { status: "failed", message };
  }

  await incrementEventAutoSummaryAttempt(eventId);

  const now = new Date();
  const { windowStart, windowEnd } = buildTranscriptSearchWindow(
    event.startsAt,
    event.endsAt,
    now
  );

  const excluded = await getProcessedDriveFileIds();
  const candidates = await listTactiqTranscripts({
    refreshToken: credential.refreshToken,
    windowStart,
    windowEnd,
  });

  const referenceTime = resolveTranscriptPickReferenceTime(
    event.startsAt,
    event.endsAt,
    now
  );
  const picked = pickBestTranscript(candidates, {
    excludedFileIds: excluded,
    referenceTime,
    eventTitle: event.title,
  });

  if (!picked) {
    const deadlineHours = getAutoSummaryScanDeadlineHours();
    const retryDelaySec = resolveAutoSummaryRetryDelaySeconds();
    const nextRunAt = new Date(now.getTime() + retryDelaySec * 1000);
    const pastDeadline = isAutoSummaryScanPastDeadline(event.startsAt, now);
    const nextWouldExceedDeadline = isAutoSummaryScanPastDeadline(
      event.startsAt,
      nextRunAt
    );

    if (pastDeadline || nextWouldExceedDeadline) {
      const message = "transcript_not_found";
      await markEventAutoSummaryFailed(eventId, message);
      try {
        const client = createMessagingClient();
        await client.pushMessage({
          to: event.lineGroupId,
          messages: [
            {
              type: "text",
              text: [
                "【自動會議摘要】",
                `在 Drive 的 Tactiq 資料夾找不到這場會議的逐字稿（已於會議開始後 ${deadlineHours} 小時內重試）。`,
                "請確認 Tactiq 已開啟 CC 並同步到 Drive，或手動貼上逐字稿連結請我總結。",
              ].join("\n"),
            },
          ],
        });
      } catch (pushErr) {
        console.error("[tactiq-scan.notify-not-found]", pushErr);
      }
      return { status: "failed", message };
    }

    const nextAttempt = attempt + 1;
    await publishTactiqScanJob({
      eventId,
      attempt: nextAttempt,
      delaySeconds: retryDelaySec,
    });

    return {
      status: "retry_scheduled",
      attempt,
      nextAttempt,
    };
  }

  try {
    const client = createMessagingClient();
    await client.pushMessage({
      to: event.lineGroupId,
      messages: [
        {
          type: "text",
          text: "【自動會議摘要】已找到會議逐字稿，正在整理重點與待辦…",
        },
      ],
    });
  } catch (pushErr) {
    console.error("[tactiq-scan.notify-started]", pushErr);
  }

  const { summaryId } = await startSummaryFromDriveFile({
    lineGroupId: event.lineGroupId,
    hostLineUserId,
    sourceDriveFileId: picked.fileId,
    sourceDriveUrl: picked.webViewLink,
    eventId,
  });

  await markEventAutoSummaryCompleted(eventId);

  return { status: "started", summaryId, fileId: picked.fileId };
}

/** Manual scan: latest transcript in the last few hours for a group. */
export async function runTactiqScanForGroup(input: {
  lineGroupId: string;
  hostLineUserId: string;
  lookbackHours?: number;
}): Promise<TactiqScanResult> {
  const hostLineUserId =
    process.env.TACTIQ_HOST_LINE_USER_ID?.trim() || input.hostLineUserId;

  const credential = await getGoogleCredentialByLineUserId(hostLineUserId);
  if (!credential) {
    return { status: "failed", message: "missing_google_credential" };
  }

  const now = new Date();
  const lookbackMs = (input.lookbackHours ?? 6) * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - lookbackMs);

  const excluded = await getProcessedDriveFileIds();
  const candidates = await listTactiqTranscripts({
    refreshToken: credential.refreshToken,
    windowStart,
    windowEnd: now,
  });

  const picked = pickBestTranscript(candidates, {
    excludedFileIds: excluded,
    referenceTime: now,
  });
  if (!picked) {
    return { status: "failed", message: "transcript_not_found" };
  }

  const { summaryId } = await startSummaryFromDriveFile({
    lineGroupId: input.lineGroupId,
    hostLineUserId,
    sourceDriveFileId: picked.fileId,
    sourceDriveUrl: picked.webViewLink,
  });

  return { status: "started", summaryId, fileId: picked.fileId };
}
