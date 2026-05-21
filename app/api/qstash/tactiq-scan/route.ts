import { RepositoryError } from "@/lib/db/repository";
import { runTactiqScanForEvent } from "@/lib/summaries/tactiqScan";
import type { TactiqScanJobPayload } from "@/lib/summaries/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function handleTactiqScanRequest(request: Request) {
  let body: TactiqScanJobPayload;
  try {
    body = (await request.json()) as TactiqScanJobPayload;
  } catch {
    return errorResponse("請求內容不是有效 JSON。", 400);
  }

  const eventId = Number(body.eventId);
  if (!Number.isFinite(eventId)) {
    return errorResponse("缺少有效的 eventId。", 400);
  }

  const attempt = Number(body.attempt);
  const normalizedAttempt = Number.isFinite(attempt) ? attempt : 1;

  try {
    const result = await runTactiqScanForEvent({
      eventId,
      attempt: normalizedAttempt,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[tactiq-scan]", error);
    const message = error instanceof Error ? error.message : "掃描失敗。";
    return errorResponse(message, 500);
  }
}

export async function POST(request: Request) {
  const { verifySignatureAppRouter } = await import("@upstash/qstash/nextjs");
  return verifySignatureAppRouter(handleTactiqScanRequest)(request);
}
