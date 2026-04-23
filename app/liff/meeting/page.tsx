"use client";

import liff from "@line/liff";
import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { initLiffOrThrow } from "@/lib/liff/client";
import { LIFF_ID, MISSING_LIFF_ENV_MSG } from "@/lib/liff/utils";
import { LIFF_UI_THEME as THEME } from "@/lib/liff/liffUiTheme";
import MemberMultiSelect from "@/lib/tools/MemberMultiSelect";

type Status =
  | "loading"
  | "loadingMembers"
  | "ready"
  | "submitting"
  | "done"
  | "error";

type GroupMember = {
  userId: number;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
};

export default function MeetingLiffPage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>(
    LIFF_ID ? "" : MISSING_LIFF_ENV_MSG
  );
  const { isCompact } = useResponsiveFlags();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [groupId, setGroupId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!LIFF_ID) return;

    let cancelled = false;
    (async () => {
      try {
        await initLiffOrThrow(LIFF_ID, "meeting");

        const params = new URLSearchParams(window.location.search);
        const nextGroupId = params.get("groupId")?.trim();
        const nextAccessToken = liff.getAccessToken()?.trim();
        const currentLineUserId = liff.getDecodedIDToken()?.sub?.trim() ?? null;

        if (!nextGroupId) {
          throw new Error("缺少群組資訊，請從機器人在群組內提供的 LIFF 連結開啟。");
        }
        if (!nextAccessToken) {
          throw new Error("無法取得 LINE access token。");
        }
        if (cancelled) return;

        setGroupId(nextGroupId);
        setAccessToken(nextAccessToken);
        setStatus("loadingMembers");

        const response = await fetch(
          `/api/group-members?groupId=${encodeURIComponent(nextGroupId)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${nextAccessToken}`,
            },
            cache: "no-store",
          }
        );

        const payload = (await response.json()) as {
          error?: string;
          currentLineUserId?: string;
          members?: GroupMember[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "讀取群組成員失敗");
        }

        const nextMembers = payload.members ?? [];
        const fallbackCurrentUserId = payload.currentLineUserId ?? currentLineUserId;
        const defaultSelected = nextMembers
          .filter((member) => member.lineUserId === fallbackCurrentUserId)
          .map((member) => String(member.userId));

        if (cancelled) return;

        setMembers(nextMembers);
        setSelectedAttendeeIds(defaultSelected);
        setStatus("ready");
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status !== "ready") return;
    if (selectedAttendeeIds.length === 0) {
      window.alert("請至少選擇一位參與者。");
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          groupId,
          title,
          date,
          time,
          location,
          note,
          attendeeUserIds: selectedAttendeeIds.map(Number),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        notificationSent?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "建立活動失敗");
      }

      setStatus("done");

      if (payload.notificationSent === false) {
        window.alert("活動已建立，但群組通知送出失敗。");
      }

      if (liff.isInClient()) {
        window.setTimeout(() => liff.closeWindow(), 800);
      }
    } catch (err) {
      setStatus("ready");
      window.alert("送出失敗：" + (err instanceof Error ? err.message : "unknown"));
    }
  }

  const disabled = status !== "ready";

  return (
    <main
      style={{
        ...mainStyle,
        padding: isCompact ? "0.75rem 0.65rem calc(1rem + env(safe-area-inset-bottom, 0px))" : "1.25rem 1rem calc(1.5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={pageInnerStyle}>
        <h1
          style={{
            ...pageTitleStyle,
            fontSize: isCompact ? "2.1rem" : "2.5rem",
          }}
        >
          預約會議
        </h1>
        <p style={pageSubtitleStyle}>
          填寫資料送出後，會建立活動並通知群組。
        </p>

        {status === "error" && <div style={errorBoxStyle}>{errorMsg}</div>}

        <div style={formPanelStyle}>
          <form onSubmit={handleSubmit} style={formStyle}>
            <Field label="會議主題" required>
              <input
                style={inputStyle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：專案同步會議"
                required
                disabled={disabled}
                autoComplete="off"
              />
            </Field>

            <Row isCompact={isCompact}>
              <Field label="日期" required>
                <input
                  style={inputStyle}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  disabled={disabled}
                />
              </Field>
              <Field label="時間" required>
                <input
                  style={inputStyle}
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  disabled={disabled}
                />
              </Field>
            </Row>

            <Field label="地點">
              <input
                style={inputStyle}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="選填，例如：會議室 A、線上連結"
                disabled={disabled}
              />
            </Field>

            <Field label="備註">
              <textarea
                style={{ ...inputStyle, minHeight: "5.5rem", resize: "vertical" }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="選填"
                disabled={disabled}
              />
            </Field>

            <Field label="參與者" required>
              <MemberMultiSelect
                members={members}
                selectedIds={selectedAttendeeIds}
                onChange={setSelectedAttendeeIds}
                disabled={disabled || members.length === 0}
                compact={isCompact}
              />
            </Field>

            <button
              type="submit"
              style={{
                ...submitButtonStyle,
                opacity: disabled ? 0.55 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
              disabled={disabled}
            >
              {status === "submitting"
                ? "送出中…"
                : status === "done"
                  ? "已送出"
                  : status === "loading" || status === "loadingMembers"
                    ? "載入中…"
                    : "送出預約"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>
        {label}
        {required && <span style={requiredStyle}> *</span>}
      </span>
      {children}
    </label>
  );
}

function Row({
  children,
  isCompact,
}: {
  children: ReactNode;
  isCompact?: boolean;
}) {
  return (
    <div
      style={{
        ...rowStyle,
        flexDirection: isCompact ? "column" : "row",
      }}
    >
      {children}
    </div>
  );
}

function useResponsiveFlags() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return { isCompact };
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(165deg, ${THEME.pageBg} 0%, ${THEME.pageBgAlt} 55%, ${THEME.pageBg} 100%)`,
  color: THEME.text,
};

const pageInnerStyle: CSSProperties = {
  maxWidth: "26rem",
  width: "100%",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "0.65rem",
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  color: THEME.text,
  letterSpacing: "-0.03em",
  fontWeight: 800,
  lineHeight: 1.15,
};

const pageSubtitleStyle: CSSProperties = {
  margin: "0 0 0.35rem",
  fontSize: "0.9rem",
  color: THEME.textMuted,
  lineHeight: 1.45,
};

const formPanelStyle: CSSProperties = {
  background: `linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.88) 100%)`,
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: THEME.radiusPanel,
  padding: "1.1rem 1rem 1.15rem",
  boxShadow: THEME.shadowPanel,
  backdropFilter: `saturate(1.1) blur(${THEME.glassBlur})`,
  WebkitBackdropFilter: `saturate(1.1) blur(${THEME.glassBlur})`,
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.1rem",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.45rem",
  flex: 1,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  fontSize: "0.82rem",
  fontWeight: 700,
  color: THEME.textMuted,
};

const requiredStyle: CSSProperties = {
  color: THEME.accent,
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const inputStyle: CSSProperties = {
  background: THEME.surfaceSubtle,
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: THEME.radiusInput,
  color: THEME.text,
  padding: "0.85rem 0.95rem",
  fontSize: "1rem",
  fontFamily: "inherit",
  width: "100%",
  minHeight: "2.85rem",
  boxSizing: "border-box",
  WebkitTapHighlightColor: "transparent",
  boxShadow: THEME.shadowCard,
};

const submitButtonStyle: CSSProperties = {
  marginTop: "0.35rem",
  width: "100%",
  minHeight: "3rem",
  background: THEME.accent,
  color: "#FFFFFF",
  border: "none",
  borderRadius: "18px",
  padding: "0.75rem 1rem",
  fontSize: "1.02rem",
  fontWeight: 800,
  letterSpacing: "0.02em",
  boxShadow: `0 8px 22px rgba(${THEME.accentRgb}, 0.35)`,
  WebkitTapHighlightColor: "transparent",
};

const errorBoxStyle: CSSProperties = {
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  color: THEME.errorText,
  padding: "0.75rem 1rem",
  borderRadius: THEME.radiusControl,
  fontSize: "0.9rem",
  boxShadow: THEME.shadowCard,
};
