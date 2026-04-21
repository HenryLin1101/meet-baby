export type VerifiedLineUserProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  statusMessage: string | null;
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

export async function verifyLineAccessToken(
  accessToken: string
): Promise<VerifiedLineUserProfile> {
  const response = await fetch("https://api.line.me/v2/profile", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

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
  };
}
