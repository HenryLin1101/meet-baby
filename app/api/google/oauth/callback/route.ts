import {
  consumeGoogleOAuthState,
  upsertGoogleCredentialForLineUser,
} from "@/lib/db/repository";
import { exchangeCodeForTokens } from "@/lib/google/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const error = url.searchParams.get("error")?.trim();

  if (error) {
    return html(
      `<h2>授權失敗</h2><p>${escapeHtml(error)}</p><p>請回到 LINE 再試一次。</p>`,
      400
    );
  }
  if (!code || !state) {
    return html("<h2>授權失敗</h2><p>缺少 code/state。</p>", 400);
  }

  try {
    const consumed = await consumeGoogleOAuthState(state);
    if (!consumed) {
      return html("<h2>授權失敗</h2><p>state 已過期或無效。</p>", 400);
    }

    const tokens = await exchangeCodeForTokens(code);
    const refreshToken = tokens.refresh_token?.trim();
    if (!refreshToken) {
      return html(
        "<h2>授權失敗</h2><p>未取得 refresh token。請先在 Google 授權畫面同意並確保使用 prompt=consent。</p>",
        400
      );
    }

    await upsertGoogleCredentialForLineUser({
      lineUserId: consumed.lineUserId,
      refreshToken,
      scopes: tokens.scope ?? null,
    });

    const redirectUrl = consumed.redirectUrl?.trim() || "";
    if (redirectUrl) {
      return html(
        [
          "<h2>授權成功</h2>",
          "<p>正在帶你回到 LINE…（若未自動跳轉，請點下方按鈕）</p>",
          `<p><a href="${escapeHtml(redirectUrl)}">回到 LINE / LIFF</a></p>`,
          "<script>",
          `window.setTimeout(function(){ window.location.href = ${JSON.stringify(
            redirectUrl
          )}; }, 400);`,
          "</script>",
        ].join("")
      );
    }

    return html(
      [
        "<h2>授權成功</h2>",
        "<p>你可以關閉此頁面，回到 LINE 群組再貼一次逐字稿連結，讓米特寶寶開始整理。</p>",
      ].join("")
    );
  } catch (err) {
    console.error("[google-oauth.callback]", err);
    return html("<h2>授權失敗</h2><p>處理授權回呼時發生錯誤。</p>", 500);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

