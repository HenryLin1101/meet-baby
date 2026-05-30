import {
  getGoogleCredentialByLineUserId,
  hasCalendarScope,
  markGoogleCredentialRevoked,
  upsertLineUser,
} from "@/lib/db/repository";
import { getBearerToken, LineAuthError, verifyLineAccessToken } from "@/lib/line/auth";
import { buildLiffUrl } from "@/lib/liff/utils";
import { GoogleRefreshTokenInvalidError, refreshAccessToken } from "@/lib/google/oauth";

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
  const groupId = searchParams.get("groupId")?.trim() ?? null;

  try {
    const verifiedUser = await verifyLineAccessToken(accessToken);
    await upsertLineUser({
      lineUserId: verifiedUser.lineUserId,
      displayName: verifiedUser.displayName,
      pictureUrl: verifiedUser.pictureUrl,
      statusMessage: verifiedUser.statusMessage,
      email: verifiedUser.email,
    });

    const credential = await getGoogleCredentialByLineUserId(verifiedUser.lineUserId);

    if (credential && hasCalendarScope(credential)) {
      // The stored scopes look right, but the refresh token may be expired or
      // revoked (e.g. Testing-mode 7-day expiry). Validate it now by attempting
      // a refresh — otherwise the form offers a Meet link that silently fails at
      // submit. On invalid_grant, drop the dead token and fall through to the
      // consent prompt; transient errors propagate to the 500 handler.
      try {
        await refreshAccessToken(credential.refreshToken);
        return Response.json({ hasCalendarScope: true });
      } catch (err) {
        if (!(err instanceof GoogleRefreshTokenInvalidError)) throw err;
        await markGoogleCredentialRevoked(verifiedUser.lineUserId);
      }
    }

    // Build a consent page URL that returns the user to the LIFF meeting form.
    const liffRedirectUrl = buildLiffUrl("/liff/meeting", groupId ? { groupId } : {});
    const consentPageParams = new URLSearchParams({
      lineUserId: verifiedUser.lineUserId,
    });
    if (liffRedirectUrl) {
      consentPageParams.set("redirectUrl", liffRedirectUrl);
    }

    const consentPageUrl = `/api/google/oauth/consent?${consentPageParams.toString()}`;

    return Response.json({ hasCalendarScope: false, consentPageUrl });
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[calendar-scope]", error);
    return errorResponse("讀取 Google 授權狀態失敗。", 500);
  }
}
