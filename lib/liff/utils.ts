const DEFAULT_LIFF_REDIRECT_PATH = "/liff/dashboard";

export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
export const MISSING_LIFF_ENV_MSG =
  "尚未設定 NEXT_PUBLIC_LIFF_ID，請於環境變數加入 LIFF ID。";

export function buildLiffUrl(
  path?: string,
  query?: Record<string, string | null | undefined>
): string | null {
  const id = LIFF_ID?.trim();
  if (!id) return null;
  if (!path) return `https://liff.line.me/${id}`;

  const normalizedPath = path.replace(/^\/+/, "");
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      const trimmedValue = value?.trim();
      if (!trimmedValue) continue;
      params.set(key, trimmedValue);
    }
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return `https://liff.line.me/${id}/${normalizedPath}${suffix}`;
}

export function resolveLiffRedirectPath(search: string): string {
  const params = new URLSearchParams(search);
  const liffState = params.get("liff.state");
  if (!liffState) return DEFAULT_LIFF_REDIRECT_PATH;

  try {
    const parsed = new URL(liffState, "https://dummy.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return liffState.startsWith("/") ? liffState : `/${liffState}`;
  }
}
