import { createGoogleOAuthState } from "@/lib/db/repository";
import { getBearerToken, LineAuthError, verifyLineAccessToken } from "@/lib/line/auth";
import { buildGoogleOAuthConsentUrl, GOOGLE_DRIVE_READONLY_SCOPE } from "@/lib/google/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return errorResponse("缺少 LINE access token。", 401);
  }

  try {
    const verifiedUser = await verifyLineAccessToken(accessToken);

    const state = randomState();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await createGoogleOAuthState({
      lineUserId: verifiedUser.lineUserId,
      state,
      expiresAt,
    });

    const authUrl = buildGoogleOAuthConsentUrl({
      state,
      scopes: [GOOGLE_DRIVE_READONLY_SCOPE],
    });

    return Response.json({ authUrl });
  } catch (error) {
    if (error instanceof LineAuthError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[google-oauth.start]", error);
    return errorResponse("建立授權連結失敗。", 500);
  }
}

