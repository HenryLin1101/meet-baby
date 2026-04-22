import {
  claimEventSummary,
  getEventSummaryProcessingDetails,
  getGoogleCredentialByLineUserId,
  markEventSummaryCompleted,
  markEventSummaryFailed,
} from "@/lib/db/repository";
import { exportGoogleDocAsPlainText } from "@/lib/google/drive";
import { createMessagingClient } from "@/lib/line/messagingClient";
import {
  formatMeetingSummaryForLine,
  summarizeMeetingTranscript,
} from "@/lib/ai/openai";
import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SummaryJobPayload = {
  summaryId?: number;
};

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function handleSummaryJob(request: Request) {
  let body: SummaryJobPayload;
  try {
    body = (await request.json()) as SummaryJobPayload;
  } catch {
    return errorResponse("請求內容不是有效 JSON。", 400);
  }

  const summaryId = Number(body.summaryId);
  if (!Number.isFinite(summaryId)) {
    return errorResponse("summaryId 格式不正確。", 400);
  }

  const claimed = await claimEventSummary(summaryId);
  if (!claimed) {
    return Response.json({ ok: true, skipped: "already-processing-or-done" });
  }

  const details = await getEventSummaryProcessingDetails(summaryId);
  if (!details) {
    return errorResponse("找不到總結任務。", 404);
  }

  const client = createMessagingClient();

  try {
    const credential = await getGoogleCredentialByLineUserId(
      details.requestedByLineUserId
    );
    if (!credential) {
      const consentUrl = new URL("/api/google/oauth/consent", getAppBaseUrlOrThrow());
      consentUrl.searchParams.set("lineUserId", details.requestedByLineUserId);
      consentUrl.searchParams.set("groupId", details.lineGroupId);
      const msg = [
        "我需要 Google Drive 授權才能讀取逐字稿。",
        "請用 Safari/Chrome 開啟下方連結完成授權（LINE 內建瀏覽器會被 Google 擋）。",
        consentUrl.toString(),
        "授權完成後，請回到群組再把逐字稿連結貼一次給我。",
      ].join("\n");

      await client.pushMessage({
        to: details.lineGroupId,
        messages: [{ type: "text", text: msg }],
      });

      await markEventSummaryFailed({
        summaryId,
        message: "missing_google_credential",
      });
      return Response.json({ ok: true, failed: "missing_google_credential" });
    }

    const exported = await exportGoogleDocAsPlainText({
      fileId: details.sourceDriveFileId,
      refreshToken: credential.refreshToken,
    });

    const summary = await summarizeMeetingTranscript({
      title: exported.title,
      transcript: exported.text,
    });

    const summaryText = formatMeetingSummaryForLine({
      title: exported.title,
      summary,
      sourceUrl: details.sourceDriveUrl,
    });

    await markEventSummaryCompleted({
      summaryId,
      transcriptText: exported.text,
      summaryJson: summary,
      summaryText,
    });

    await client.pushMessage({
      to: details.lineGroupId,
      messages: [{ type: "text", text: summaryText }],
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[qstash.summary]", err);
    const message = err instanceof Error ? err.message : "unknown error";
    try {
      await markEventSummaryFailed({ summaryId, message });
    } catch (dbErr) {
      console.error("[qstash.summary.mark-failed]", dbErr);
    }

    await client.pushMessage({
      to: details.lineGroupId,
      messages: [
        {
          type: "text",
          text: ["【會議總結失敗】", message].join("\n"),
        },
      ],
    });

    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { verifySignatureAppRouter } = await import("@upstash/qstash/nextjs");
  return verifySignatureAppRouter(handleSummaryJob)(request);
}

