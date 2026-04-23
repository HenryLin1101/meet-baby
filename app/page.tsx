"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { initLiffOrThrow } from "@/lib/liff/client";
import {
  LIFF_ID,
  MISSING_LIFF_ENV_MSG,
  resolveLiffRedirectPath,
} from "@/lib/liff/utils";
import MascotLoadingScreen from "@/lib/liff/MascotLoadingScreen";
import { LIFF_UI_THEME as T } from "@/lib/liff/liffUiTheme";

type Status = "loading" | "redirecting" | "error";

export default function HomePage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState(LIFF_ID ? "" : MISSING_LIFF_ENV_MSG);

  useEffect(() => {
    if (!LIFF_ID) return;

    let cancelled = false;
    (async () => {
      try {
        await initLiffOrThrow(LIFF_ID, "home");
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

  if (status === "loading" || status === "redirecting") {
    return <MascotLoadingScreen />;
  }

  return (
    <main style={errorMainStyle}>
      <div style={errorCardStyle}>
        <p style={errorTextStyle}>{errorMsg}</p>
      </div>
    </main>
  );
}

const errorMainStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem 1.25rem",
  background: T.surface,
};

const errorCardStyle: CSSProperties = {
  maxWidth: "30rem",
  width: "100%",
  border: `1px solid ${T.surfaceBorder}`,
  borderRadius: T.radiusPanel,
  padding: "1.5rem",
  boxShadow: T.shadowCard,
};

const errorTextStyle: CSSProperties = {
  margin: 0,
  color: T.errorText,
  fontSize: "0.95rem",
  lineHeight: 1.5,
};
