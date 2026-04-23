"use client";

import { LIFF_MASCOT_IMAGE_PATH, LIFF_UI_THEME as T } from "@/lib/liff/liffUiTheme";

const TRAIL_KEYFRAMES = `
@keyframes liffMascotTrailDot {
  0% {
    transform: translate(0, 0) scale(0.75);
    opacity: 0.35;
  }
  25% {
    opacity: 1;
  }
  100% {
    transform: translate(88px, -88px) scale(0.35);
    opacity: 0;
  }
}
`;

const DOT_COUNT = 6;

/**
 * 全螢幕載入：白底、中央吉祥物、右上角點點往右上循環（LIFF 首頁 / Dashboard / 預約會議共用）。
 */
export default function MascotLoadingScreen() {
  return (
    <>
      <style>{TRAIL_KEYFRAMES}</style>
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="載入中"
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
          aria-hidden
          style={{
            position: "absolute",
            top: "max(0.75rem, env(safe-area-inset-top))",
            right: "max(0.85rem, env(safe-area-inset-right))",
            width: "6px",
            height: "6px",
            pointerEvents: "none",
          }}
        >
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: T.accent,
                boxShadow: `0 0 10px rgba(${T.accentRgb}, 0.65)`,
                animation: "liffMascotTrailDot 1.35s ease-in-out infinite",
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LIFF_MASCOT_IMAGE_PATH}
          alt="米特寶寶"
          width={280}
          height={280}
          style={{
            maxWidth: "min(72vw, 260px)",
            width: "100%",
            height: "auto",
            objectFit: "contain",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </div>
    </>
  );
}
