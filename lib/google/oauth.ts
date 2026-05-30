import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";

export type GoogleOAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

/**
 * Thrown when Google rejects a refresh token with `invalid_grant` — the token
 * is expired (e.g. Testing-mode 7-day expiry) or revoked and can never be used
 * again. Callers should mark the stored credential revoked and re-prompt the
 * user for OAuth consent. Distinct from transient (5xx/network) failures, which
 * remain plain Errors and should be retried, not re-authed.
 */
export class GoogleRefreshTokenInvalidError extends Error {
  constructor(message = "Google refresh token is invalid or expired.") {
    super(message);
    this.name = "GoogleRefreshTokenInvalidError";
  }
}

function getGoogleClientIdOrThrow(): string {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id) throw new Error("GOOGLE_CLIENT_ID 尚未設定。");
  return id;
}

function getGoogleClientSecretOrThrow(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET 尚未設定。");
  return secret;
}

export function getGoogleOAuthRedirectUri(): string {
  return new URL("/api/google/oauth/callback", getAppBaseUrlOrThrow()).toString();
}

export const GOOGLE_DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

export const GOOGLE_CALENDAR_EVENTS_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

export function buildGoogleOAuthConsentUrl(input: {
  state: string;
  scopes?: string[];
}): string {
  const clientId = getGoogleClientIdOrThrow();
  const redirectUri = getGoogleOAuthRedirectUri();
  const baseScopes = input.scopes?.length ? input.scopes : [GOOGLE_DRIVE_READONLY_SCOPE];
  const scopes = Array.from(new Set([...baseScopes, "openid", "email"]));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: scopes.join(" "),
    state: input.state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleOAuthTokenResponse> {
  const clientId = getGoogleClientIdOrThrow();
  const clientSecret = getGoogleClientSecretOrThrow();
  const redirectUri = getGoogleOAuthRedirectUri();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
    cache: "no-store",
  });

  const json = (await response.json()) as GoogleOAuthTokenResponse & { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? "Google token exchange failed");
  }
  return json;
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn?: number;
  scope?: string;
}> {
  const clientId = getGoogleClientIdOrThrow();
  const clientSecret = getGoogleClientSecretOrThrow();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
    cache: "no-store",
  });

  const json = (await response.json()) as GoogleOAuthTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok) {
    // `invalid_grant` means the refresh token itself is dead (expired/revoked) —
    // re-authing is the only fix. Everything else (5xx, invalid_client, network)
    // is transient or a config issue and should NOT revoke the user's credential.
    if (json.error === "invalid_grant") {
      throw new GoogleRefreshTokenInvalidError(
        json.error_description ?? "Google refresh token is invalid or expired."
      );
    }
    throw new Error(json.error_description ?? json.error ?? "Google refresh token failed");
  }
  const accessToken = json.access_token?.trim();
  if (!accessToken) {
    throw new Error("Google refresh token response missing access_token.");
  }
  return { accessToken, expiresIn: json.expires_in, scope: json.scope };
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { email?: string };
    return data.email?.trim() || null;
  } catch {
    return null;
  }
}

