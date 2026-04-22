"use client";

import liff from "@line/liff";
import { useEffect, useState, type CSSProperties } from "react";
import { initLiffOrThrow } from "@/lib/liff/client";
import { LIFF_ID, MISSING_LIFF_ENV_MSG } from "@/lib/liff/utils";

type Status = "loading" | "ready" | "redirecting" | "done" | "error";

export default function GoogleAuthLiffPage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>(
    LIFF_ID ? "" : MISSING_LIFF_ENV_MSG
  );

  useEffect(() => {
    if (!LIFF_ID) return;
    let cancelled = false;
    (async () => {
      try {
        await initLiffOrThrow(LIFF_ID, "google-auth");
        const accessToken = liff.getAccessToken()?.trim();
        if (!accessToken) {
          throw new Error("無法取得 LINE access token。");
        }
        if (cancelled) return;

        setStatus("ready");
        setStatus("redirecting");

        const response = await fetch("/api/google/oauth/start", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        const payload = (await response.json()) as { authUrl?: string; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "建立授權連結失敗");
        }
        const authUrl = payload.authUrl?.trim();
        if (!authUrl) {
          throw new Error("授權連結不存在。");
        }

        if (cancelled) return;
        window.location.href = authUrl;
        setStatus("done");
      } catch (err) {
        console.error("[google-auth] init failed", err);
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "初始化失敗");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Google 授權</h1>
        <p style={subtitleStyle}>
          {status === "loading"
            ? "LIFF 載入中…"
            : status === "redirecting"
              ? "正在跳轉到 Google 授權頁…"
              : status === "error"
                ? "初始化失敗"
                : "準備中…"}
        </p>
        {status === "error" && <div style={errorBoxStyle}>{errorMsg}</div>}
        <p style={hintStyle}>
          授權完成後，請回到 LINE 群組再貼一次逐字稿連結。
        </p>
      </div>
    </main>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  padding: "2rem 1rem",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "30rem",
  background:
    "linear-gradient(180deg, rgba(37, 48, 66, 0.94) 0%, rgba(23, 31, 43, 0.92) 100%)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: "24px",
  padding: "1.5rem",
  backdropFilter: "blur(14px)",
  boxShadow: "0 24px 60px rgba(58, 72, 95, 0.22)",
};

const titleStyle: CSSProperties = {
  margin: "0 0 0.4rem",
  fontSize: "1.5rem",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
};

const hintStyle: CSSProperties = {
  marginTop: "1.1rem",
  fontSize: "0.9rem",
  color: "var(--muted)",
  lineHeight: 1.5,
};

const errorBoxStyle: CSSProperties = {
  background: "rgba(220, 70, 70, 0.12)",
  border: "1px solid rgba(220, 70, 70, 0.4)",
  color: "#ffb4b4",
  padding: "0.75rem 1rem",
  borderRadius: "10px",
  marginTop: "1rem",
  fontSize: "0.9rem",
};

