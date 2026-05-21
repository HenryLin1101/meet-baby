"use client";

import liff from "@line/liff";
import { useEffect, useState, type CSSProperties } from "react";
import { initLiffOrThrow } from "@/lib/liff/client";
import { LIFF_ID, MISSING_LIFF_ENV_MSG } from "@/lib/liff/utils";
import MascotLoadingScreen from "@/lib/liff/MascotLoadingScreen";
import { LIFF_UI_THEME as T } from "@/lib/liff/liffUiTheme";

type Status = "loading" | "redirecting" | "error";

export default function DriveLiffPage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>(
    LIFF_ID ? "" : MISSING_LIFF_ENV_MSG
  );

  useEffect(() => {
    if (!LIFF_ID) return;
    let cancelled = false;

    (async () => {
      try {
        await initLiffOrThrow(LIFF_ID, "drive");

        const params = new URLSearchParams(window.location.search);
        const groupId = params.get("groupId")?.trim();
        if (!groupId) {
          throw new Error("缺少群組資訊，請從機器人在群組內提供的連結開啟。");
        }

        const accessToken = liff.getAccessToken()?.trim();
        if (!accessToken) {
          throw new Error("無法取得 LINE access token。");
        }
        if (cancelled) return;

        setStatus("redirecting");

        const res = await fetch(
          `/api/google/drive-folder?groupId=${encodeURIComponent(groupId)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          }
        );

        const payload = (await res.json()) as {
          driveFolderUrl?: string;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(payload.error ?? "無法取得 Drive 資料夾連結。");
        }

        const url = payload.driveFolderUrl?.trim();
        if (!url) {
          throw new Error("Drive 資料夾連結不存在。");
        }

        if (cancelled) return;
        window.location.href = url;
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "發生未知錯誤。");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading" || status === "redirecting") {
    return <MascotLoadingScreen />;
  }

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>無法開啟資料夾</h1>
        <p style={errorStyle}>{errorMsg}</p>
      </div>
    </main>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  background: T.pageBg,
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "28rem",
  background: T.surface,
  borderRadius: T.radiusPanel,
  padding: "1.5rem",
  boxShadow: T.shadowPanel,
  border: `1px solid ${T.surfaceBorder}`,
};

const titleStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  fontSize: "1.15rem",
  fontWeight: 700,
  color: T.text,
};

const errorStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  color: T.errorText,
  background: T.errorBg,
  border: `1px solid ${T.errorBorder}`,
  borderRadius: T.radiusControl,
  padding: "0.75rem 1rem",
  lineHeight: 1.5,
};
