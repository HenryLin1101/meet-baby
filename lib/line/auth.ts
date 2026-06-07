export type VerifiedLineUserProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  statusMessage: string | null;
  email: string | null;
};

export class LineAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "LineAuthError";
  }
}

export function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;

  const trimmedToken = token?.trim();
  return trimmedToken ? trimmedToken : null;
}

export type VerifyLineAccessTokenOptions = {
  /**
   * Whether to also fetch the user's email from LINE's userinfo endpoint. This
   * is a second LINE round-trip, so it defaults to off — most callers only feed
   * the email into upsertLineUser, which preserves the stored value when none is
   * given. Set true only when a fresh LINE email is actually required.
   */
  fetchEmail?: boolean;
};

export async function verifyLineAccessToken(
  accessToken: string,
  options: VerifyLineAccessTokenOptions = {}
): Promise<VerifiedLineUserProfile> {
  const { fetchEmail = false } = options;

  // Run the profile (verification) and optional email lookups concurrently so
  // they don't stack into two serial round-trips to LINE on every request.
  const [response, email] = await Promise.all([
    fetch("https://api.line.me/v2/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }),
    fetchEmail ? fetchLineUserEmail(accessToken) : Promise.resolve(null),
  ]);

  if (!response.ok) {
    throw new LineAuthError("LINE 使用者驗證失敗。", response.status);
  }

  const profile = (await response.json()) as {
    userId?: string;
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
  };

  if (!profile.userId || !profile.displayName) {
    throw new LineAuthError("LINE 使用者資料不完整。", 401);
  }

  return {
    lineUserId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl?.trim() ?? null,
    statusMessage: profile.statusMessage?.trim() ?? null,
    email,
  };
}

async function fetchLineUserEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.line.me/oauth2/v2.1/userinfo", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { email?: string };
    return data.email?.trim() || null;
  } catch {
    return null;
  }
}
