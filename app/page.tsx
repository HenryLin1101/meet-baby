"use client";

import liff from "@line/liff";
import { useEffect, useState, type CSSProperties } from "react";
import {
  LIFF_ID,
  MISSING_LIFF_ENV_MSG,
  resolveLiffRedirectPath,
} from "@/lib/liff/utils";

type Status = "loading" | "redirecting" | "error";

export default function HomePage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState(LIFF_ID ? "" : MISSING_LIFF_ENV_MSG);

  useEffect(() => {
    if (!LIFF_ID) return;

    let cancelled = false;
    (async () => {
      try {
        await liff.init({
          liffId: LIFF_ID,
          withLoginOnExternalBrowser: true,
        });
        if (cancelled) return;

        setStatus("redirecting");
        const targetPath = resolveLiffRedirectPath(window.location.search);
        if (targetPath !== `${window.location.pathname}${window.location.search}`) {
          window.location.replace(targetPath);
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "LIFF 初始化失敗");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>米特寶寶</h1>
        <p style={subtitleStyle}>
          {status === "redirecting"
            ? "LIFF 已初始化，正在導向功能頁…"
            : status === "loading"
              ? "LIFF 初始化中…"
              : "LIFF 初始化失敗"}
        </p>
        {status === "error" && <div style={errorBoxStyle}>{errorMsg}</div>}
      </div>
    </main>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem 1.25rem",
};

const cardStyle: CSSProperties = {
  maxWidth: "30rem",
  width: "100%",
  background:
    "linear-gradient(180deg, rgba(37, 48, 66, 0.94) 0%, rgba(23, 31, 43, 0.92) 100%)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: "24px",
  padding: "2rem",
  backdropFilter: "blur(14px)",
  color: "var(--text)",
  boxShadow: "0 24px 60px rgba(58, 72, 95, 0.22)",
};

const titleStyle: CSSProperties = {
  margin: "0 0 0.5rem",
  fontSize: "1.75rem",
  color: "var(--text)",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
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
