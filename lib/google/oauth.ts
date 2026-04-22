import { getAppBaseUrlOrThrow } from "@/lib/qstash/client";

export type GoogleOAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

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

export function buildGoogleOAuthConsentUrl(input: {
  state: string;
  scopes?: string[];
}): string {
  const clientId = getGoogleClientIdOrThrow();
  const redirectUri = getGoogleOAuthRedirectUri();
  const scopes = input.scopes?.length ? input.scopes : [GOOGLE_DRIVE_READONLY_SCOPE];

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

  const json = (await response.json()) as GoogleOAuthTokenResponse & { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? "Google refresh token failed");
  }
  const accessToken = json.access_token?.trim();
  if (!accessToken) {
    throw new Error("Google refresh token response missing access_token.");
  }
  return { accessToken, expiresIn: json.expires_in, scope: json.scope };
}

