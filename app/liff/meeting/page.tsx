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
    console.log("[meeting] effect start", {
      href: typeof window === "undefined" ? null : window.location.href,
      hasLiffId: Boolean(LIFF_ID),
    });
    if (!LIFF_ID) {
      console.warn("[meeting] missing LIFF_ID");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await initLiffOrThrow(LIFF_ID, "meeting");

        const params = new URLSearchParams(window.location.search);
        const nextGroupId = params.get("groupId")?.trim();
        const nextAccessToken = liff.getAccessToken()?.trim();
        const currentLineUserId = liff.getDecodedIDToken()?.sub?.trim() ?? null;
        console.log("[meeting] liff init complete", {
          nextGroupId,
          hasAccessToken: Boolean(nextAccessToken),
          currentLineUserId,
          search: window.location.search,
        });

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
        console.log("[meeting] fetching group members", {
          groupId: nextGroupId,
        });

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
        console.log("[meeting] group members response", {
          ok: response.ok,
          status: response.status,
          error: payload.error,
          currentLineUserId: payload.currentLineUserId,
          memberCount: payload.members?.length ?? 0,
        });

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
        console.error("[meeting] init failed", err);
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
    console.log("[meeting] submitting event", {
      groupId,
      title,
      date,
      time,
      location,
      note,
      attendeeUserIds: selectedAttendeeIds.map(Number),
      hasAccessToken: Boolean(accessToken),
    });

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
      console.log("[meeting] create event response", {
        ok: response.ok,
        status: response.status,
        error: payload.error,
        notificationSent: payload.notificationSent,
      });

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
      console.error("[meeting] submit failed", err);
      setStatus("ready");
      window.alert("送出失敗：" + (err instanceof Error ? err.message : "unknown"));
    }
  }

  const disabled = status !== "ready";

  return (
    <main
      style={{
        ...mainStyle,
        padding: isCompact ? "1rem 0.85rem 1.5rem" : "2rem 1rem",
      }}
    >
      <div
        style={{
          ...cardStyle,
          maxWidth: isCompact ? "100%" : "34rem",
          padding: isCompact ? "1.2rem" : "1.75rem",
        }}
      >
        <div
          style={{
            ...heroStyle,
            flexDirection: isCompact ? "column" : "row",
            alignItems: isCompact ? "flex-start" : "center",
          }}
        >
          <div style={heroOrbStyle} />
          <div style={{ flex: 1 }}>
            <div style={badgeStyle}>MITE BABY</div>
            <h1 style={titleStyle}>預約會議</h1>
            <p style={subtitleStyle}>
              填好下方資訊送出，會建立活動資料並通知群組。
            </p>
          </div>
          <div style={statusStyle}>
            {status === "ready"
              ? "LIFF 已就緒"
              : status === "loading"
                ? "LIFF 載入中"
                : status === "loadingMembers"
                  ? "載入成員中"
                  : status === "submitting"
                    ? "送出中"
                    : status === "done"
                      ? "已送出"
                      : "初始化失敗"}
          </div>
        </div>

        {status === "error" && <div style={errorBoxStyle}>{errorMsg}</div>}

        <form onSubmit={handleSubmit} style={formStyle}>
          <Field label="會議主題" required>
            <input
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：專案同步會議"
              required
              disabled={disabled}
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
              placeholder="選填，例如：會議室 A / 線上 Google Meet"
              disabled={disabled}
            />
          </Field>

          <Field label="備註">
            <textarea
              style={{ ...inputStyle, minHeight: "96px", resize: "vertical" }}
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
              ...buttonStyle,
              width: "100%",
              opacity: disabled ? 0.6 : 1,
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
                  : "送出"}
          </button>
        </form>
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
  display: "flex",
  justifyContent: "center",
  padding: "2rem 1rem",
};

const cardStyle: CSSProperties = {
  maxWidth: "34rem",
  width: "100%",
  background:
    "linear-gradient(180deg, rgba(37, 48, 66, 0.94) 0%, rgba(23, 31, 43, 0.92) 100%)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: "24px",
  padding: "1.75rem",
  backdropFilter: "blur(14px)",
  boxShadow: "0 24px 60px rgba(58, 72, 95, 0.22)",
};

const heroStyle: CSSProperties = {
  display: "flex",
  gap: "1rem",
  marginBottom: "1.25rem",
};

const heroOrbStyle: CSSProperties = {
  width: "4rem",
  height: "4rem",
  borderRadius: "1.25rem",
  background:
    "radial-gradient(circle at 35% 35%, rgba(158, 238, 255, 0.95) 0%, rgba(116, 216, 242, 0.92) 42%, rgba(28, 40, 56, 0.96) 100%)",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.18), 0 12px 28px rgba(158, 238, 255, 0.24)",
  flexShrink: 0,
};

const badgeStyle: CSSProperties = {
  display: "inline-block",
  marginBottom: "0.55rem",
  padding: "0.28rem 0.7rem",
  borderRadius: "999px",
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  fontWeight: 700,
  color: "#d8f8ff",
  background: "rgba(158, 238, 255, 0.12)",
  border: "1px solid rgba(158, 238, 255, 0.2)",
};

const titleStyle: CSSProperties = {
  margin: "0 0 0.35rem",
  fontSize: "1.65rem",
  color: "var(--text)",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: "0.9rem",
};

const statusStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "0.38rem 0.75rem",
  borderRadius: "999px",
  fontSize: "0.78rem",
  whiteSpace: "nowrap",
  color: "#d8f8ff",
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.375rem",
  flex: 1,
};

const labelStyle: CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--muted)",
};

const requiredStyle: CSSProperties = {
  color: "var(--accent)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const inputStyle: CSSProperties = {
  background: "rgba(236, 242, 248, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: "14px",
  color: "var(--text)",
  padding: "0.78rem 0.9rem",
  fontSize: "1rem",
  fontFamily: "inherit",
  width: "100%",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};

const buttonStyle: CSSProperties = {
  marginTop: "0.5rem",
  background:
    "linear-gradient(135deg, rgba(158, 238, 255, 0.98) 0%, rgba(116, 216, 242, 0.96) 100%)",
  color: "#162331",
  border: 0,
  borderRadius: "14px",
  padding: "0.88rem 1rem",
  fontSize: "1rem",
  fontWeight: 700,
  boxShadow: "0 14px 24px rgba(116, 216, 242, 0.22)",
};

const errorBoxStyle: CSSProperties = {
  background: "rgba(220, 70, 70, 0.12)",
  border: "1px solid rgba(220, 70, 70, 0.4)",
  color: "#ffb4b4",
  padding: "0.75rem 1rem",
  borderRadius: "10px",
  marginBottom: "1rem",
  fontSize: "0.9rem",
};
