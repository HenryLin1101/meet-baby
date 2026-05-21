import {
  getGroupDriveFolderId,
  RepositoryError,
  upsertLineUser,
} from "@/lib/db/repository";
import { getBearerToken, LineAuthError, verifyLineAccessToken } from "@/lib/line/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
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

    const folderId = await getGroupDriveFolderId(groupId);
    if (!folderId) {
      return errorResponse("此群組尚未建立 Drive 資料夾。", 404);
    }

    const driveFolderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    return Response.json({ driveFolderUrl });
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[drive-folder]", error);
    return errorResponse("讀取 Drive 資料夾失敗。", 500);
  }
}
