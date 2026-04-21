import {
  listActiveGroupMembers,
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lineGroupId = searchParams.get("groupId")?.trim();

  if (!lineGroupId) {
    return errorResponse("缺少 groupId。", 400);
  }

  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return errorResponse("缺少 LINE access token。", 401);
  }

  try {
    const verifiedUser = await verifyLineAccessToken(accessToken);

    await upsertLineUser({
      lineUserId: verifiedUser.lineUserId,
      displayName: verifiedUser.displayName,
      pictureUrl: verifiedUser.pictureUrl,
      statusMessage: verifiedUser.statusMessage,
    });

    const members = await listActiveGroupMembers(lineGroupId);

    return Response.json({
      members,
      currentLineUserId: verifiedUser.lineUserId,
    });
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }

    console.error("[group-members]", error);
    return errorResponse("讀取群組成員失敗。", 500);
  }
}
