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
    transform: translate(52px, -52px) scale(0.35);
    opacity: 0;
  }
}
`;

const DOT_COUNT = 6;

/**
 * 全螢幕載入：白底、中央吉祥物（點點動畫在頭部右上）、下方「載入中…」。
 */
export default function MascotLoadingScreen() {
  return (
    <>
      <style>{TRAIL_KEYFRAMES}</style>
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
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "4%",
              right: "6%",
              width: "8px",
              height: "8px",
              pointerEvents: "none",
              zIndex: 1,
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
    </>
  );
}
