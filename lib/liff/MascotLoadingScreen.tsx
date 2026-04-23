"use client";

import { LIFF_MASCOT_IMAGE_PATH, LIFF_UI_THEME as T } from "@/lib/liff/liffUiTheme";

/**
 * 全螢幕載入：白底、中央吉祥物、下方「載入中…」。
 */
export default function MascotLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: T.surface,
        padding: "1.5rem",
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: "min(72vw, 260px)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LIFF_MASCOT_IMAGE_PATH}
          alt="米特寶寶"
          width={280}
          height={280}
          style={{
            width: "100%",
            height: "auto",
            maxWidth: "100%",
            objectFit: "contain",
            userSelect: "none",
            pointerEvents: "none",
            display: "block",
          }}
        />
      </div>

      <p
        style={{
          marginTop: "1rem",
          marginBottom: 0,
          fontSize: "0.95rem",
          fontWeight: 700,
          color: T.textMuted,
          letterSpacing: "0.06em",
        }}
      >
        載入中…
      </p>
    </div>
  );
}
