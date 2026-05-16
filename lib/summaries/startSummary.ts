import {
  createEventSummary,
  setEventSummaryQStashMessageId,
} from "@/lib/db/repository";
import { publishSummaryJob } from "@/lib/summaries/qstash";

export async function startSummaryFromDriveFile(input: {
  lineGroupId: string;
  hostLineUserId: string;
  sourceDriveFileId: string;
  sourceDriveUrl: string;
  eventId?: number | null;
}): Promise<{ summaryId: number; messageId: string }> {
  const created = await createEventSummary({
    lineGroupId: input.lineGroupId,
    requestedByLineUserId: input.hostLineUserId,
    sourceDriveUrl: input.sourceDriveUrl,
    sourceDriveFileId: input.sourceDriveFileId,
    eventId: input.eventId ?? null,
  });

  const job = await publishSummaryJob({ summaryId: created.summaryId });
  await setEventSummaryQStashMessageId({
    summaryId: created.summaryId,
    messageId: job.messageId,
  });

  return { summaryId: created.summaryId, messageId: job.messageId };
}
