import { createGoogleOAuthState } from "@/lib/db/repository";
import { buildGoogleOAuthConsentUrl, GOOGLE_DRIVE_READONLY_SCOPE } from "@/lib/google/oauth";
import { buildLiffUrl } from "@/lib/liff/utils";
import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lineUserId = url.searchParams.get("lineUserId")?.trim();
  const groupId = url.searchParams.get("groupId")?.trim() ?? null;

  if (!lineUserId) {
    return new Response("Missing lineUserId", { status: 400 });
  }

  const state = randomState();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Try to send user back to LIFF after OAuth finishes.
  const redirectUrl =
    buildLiffUrl("/liff/dashboard", groupId ? { groupId } : undefined) ??
    new URL("/liff/dashboard", getAppBaseUrlOrThrow()).toString();

  await createGoogleOAuthState({
    lineUserId,
    state,
    expiresAt,
    redirectUrl,
  });

  const authUrl = buildGoogleOAuthConsentUrl({
    state,
    scopes: [GOOGLE_DRIVE_READONLY_SCOPE],
  });

  return redirect(authUrl);
}

