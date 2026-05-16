import {
  deleteTodoItem,
  toggleTodoItemCompleted,
  updateTodoItem,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return errorResponse("缺少 LINE access token。", 401);
  }

  const { id: rawId } = await params;
  const todoId = Number(rawId);
  if (!Number.isFinite(todoId)) {
    return errorResponse("id 格式不正確。", 400);
  }

  let body: {
    isCompleted?: boolean;
    item?: string;
    due?: string;
    groupId?: number;
    assignedUserIds?: number[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return errorResponse("請求內容不是有效 JSON。", 400);
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

    if (typeof body.isCompleted === "boolean") {
      const result = await toggleTodoItemCompleted({
        id: todoId,
        lineUserId: verifiedUser.lineUserId,
        isCompleted: body.isCompleted,
      });
      if (!result) {
        return errorResponse("待辦事項不存在或已刪除。", 404);
      }
      return Response.json({ todoItem: result });
    }

    if (
      body.item !== undefined ||
      body.due !== undefined ||
      body.groupId !== undefined ||
      body.assignedUserIds !== undefined
    ) {
      const result = await updateTodoItem({
        id: todoId,
        lineUserId: verifiedUser.lineUserId,
        item: body.item?.trim() || undefined,
        due: body.due,
        groupId: body.groupId,
        assignedUserIds: body.assignedUserIds,
      });
      if (!result) {
        return errorResponse("待辦事項不存在或已刪除。", 404);
      }
      return Response.json({ todoItem: result });
    }

    return errorResponse("未提供任何更新欄位。", 400);
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[todo-items.patch]", error);
    return errorResponse("更新待辦事項失敗。", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return errorResponse("缺少 LINE access token。", 401);
  }

  const { id: rawId } = await params;
  const todoId = Number(rawId);
  if (!Number.isFinite(todoId)) {
    return errorResponse("id 格式不正確。", 400);
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

    const deleted = await deleteTodoItem({
      id: todoId,
      lineUserId: verifiedUser.lineUserId,
    });
    if (!deleted) {
      return errorResponse("待辦事項不存在或已刪除。", 404);
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof RepositoryError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[todo-items.delete]", error);
    return errorResponse("刪除待辦事項失敗。", 500);
  }
}
