/**
 * 吉祥物圖檔路徑（放於 `public/images/`，可替換為你的 PNG/SVG，檔名可自訂並改此常數）。
 */
export const LIFF_MASCOT_IMAGE_PATH = "/images/meet-baby.png";

/** 共用 LIFF 淺色介面（Dashboard / 預約會議等） */
export const LIFF_UI_THEME = {
  pageBg: "#F0F2F5",
  pageBgAlt: "#E8EBF0",
  surface: "#FFFFFF",
  surfaceSubtle: "#FAFBFC",
  surfaceBorder: "#D1D9E6",
  accent: "#00C2FF",
  accentRgb: "0, 194, 255",
  text: "#2D3436",
  textMuted: "#636E72",
  errorBg: "rgba(231, 76, 60, 0.1)",
  errorBorder: "rgba(231, 76, 60, 0.35)",
  errorText: "#C0392B",
  shadowCard:
    "0 6px 18px rgba(45, 52, 54, 0.06), 0 1px 4px rgba(45, 52, 54, 0.04)",
  shadowPanel:
    "0 14px 44px rgba(45, 52, 54, 0.1), 0 4px 14px rgba(45, 52, 54, 0.05)",
  radiusPanel: "24px",
  radiusControl: "16px",
  radiusInput: "16px",
  glassBlur: "18px",
} as const;
