import {
  listEventsByGroupIds,
  listUserGroups,
  RepositoryError,
  upsertLineUser,
} from "@/lib/db/repository";
import {
  getBearerToken,
  LineAuthError,
  verifyLineAccessToken,
} from "@/lib/line/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function clampDaysRange(input: { start?: string | null; end?: string | null }) {
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const defaultEnd = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

  const start = input.start ? new Date(input.start) : defaultStart;
  const end = input.end ? new Date(input.end) : defaultEnd;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new RepositoryError("rangeStart/rangeEnd 格式不正確。", 400, "INVALID_INPUT");
  }

  // Prevent accidental huge queries.
  const maxWindowMs = 366 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxWindowMs) {
    throw new RepositoryError("查詢範圍過大，請縮小時間區間。", 400, "INVALID_INPUT");
  }

  return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
}

export async function GET(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return errorResponse("缺少 LINE access token。", 401);
  }

  const { searchParams } = new URL(request.url);
  const rangeStart = searchParams.get("rangeStart")?.trim() ?? null;
  const rangeEnd = searchParams.get("rangeEnd")?.trim() ?? null;

  try {
    const verifiedUser = await verifyLineAccessToken(accessToken);
    await upsertLineUser({
      lineUserId: verifiedUser.lineUserId,
      displayName: verifiedUser.displayName,
      pictureUrl: verifiedUser.pictureUrl,
      statusMessage: verifiedUser.statusMessage,
    });

    const groups = await listUserGroups(verifiedUser.lineUserId);
    const range = clampDaysRange({ start: rangeStart, end: rangeEnd });
    const events = await listEventsByGroupIds({
      groups,
      rangeStart: range.rangeStart,
      rangeEnd: range.rangeEnd,
    });

    return Response.json({
      groups,
      events,
      range,
      currentLineUserId: verifiedUser.lineUserId,
    });
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[dashboard]", error);
    return errorResponse("讀取 Dashboard 失敗。", 500);
  }
}

