import {
  createTodoItem,
  listTodoItemsByGroupIds,
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

export async function GET(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return errorResponse("缺少 LINE access token。", 401);
  }

  try {
    const verifiedUser = await verifyLineAccessToken(accessToken);
    const currentUserId = await upsertLineUser({
      lineUserId: verifiedUser.lineUserId,
      displayName: verifiedUser.displayName,
      pictureUrl: verifiedUser.pictureUrl,
      statusMessage: verifiedUser.statusMessage,
      email: verifiedUser.email,
    });

    const groups = await listUserGroups(verifiedUser.lineUserId);
    const currentUserDisplayName = verifiedUser.displayName;

    if (groups.length === 0) {
      return Response.json({ todoItems: [], currentUserId, currentUserDisplayName });
    }

    const groupIds = groups.map((g) => g.groupId);
    const todoItems = await listTodoItemsByGroupIds(groupIds);

    return Response.json({ todoItems, currentUserId, currentUserDisplayName });
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[todo-items]", error);
    return errorResponse("讀取待辦事項失敗。", 500);
  }
}

export async function POST(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return errorResponse("缺少 LINE access token。", 401);
  }

  let body: {
    groupId?: number;
    item?: string;
    due?: string;
    assignedUserIds?: number[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return errorResponse("請求內容不是有效 JSON。", 400);
  }

  if (!body.groupId || !body.item?.trim()) {
    return errorResponse("缺少 groupId 或 item。", 400);
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

    const result = await createTodoItem({
      lineUserId: verifiedUser.lineUserId,
      groupId: body.groupId,
      item: body.item.trim(),
      due: body.due,
      assignedUserIds: body.assignedUserIds,
    });

    if (!result) {
      return errorResponse("建立待辦事項失敗。", 500);
    }
    return Response.json({ todoItem: result }, { status: 201 });
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[todo-items.post]", error);
    return errorResponse("建立待辦事項失敗。", 500);
  }
}
