"use client";

import liff from "@line/liff";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { initLiffOrThrow } from "@/lib/liff/client";
import MascotLoadingScreen from "@/lib/liff/MascotLoadingScreen";
import { LIFF_ID, MISSING_LIFF_ENV_MSG } from "@/lib/liff/utils";

const THEME = {
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
  shadowCard: "0 6px 18px rgba(45, 52, 54, 0.06), 0 1px 4px rgba(45, 52, 54, 0.04)",
  shadowPanel: "0 14px 44px rgba(45, 52, 54, 0.1), 0 4px 14px rgba(45, 52, 54, 0.05)",
  radiusPanel: "24px",
  radiusControl: "22px",
} as const;

type Status = "loading" | "ready" | "error";

type Group = {
  groupId: number;
  lineGroupId: string;
  name: string | null;
  pictureUrl: string | null;
};

type Message = {
  role: "user" | "assistant";
  text: string;
};

export default function RagLiffPage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState(LIFF_ID ? "" : MISSING_LIFF_ENV_MSG);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!LIFF_ID) return;
    let cancelled = false;
    (async () => {
      try {
        await initLiffOrThrow(LIFF_ID, "rag");
        const token = liff.getAccessToken()?.trim();
        if (!token) throw new Error("無法取得 LINE access token。");
        if (cancelled) return;
        setAccessToken(token);

        const res = await fetch("/api/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = (await res.json()) as { groups?: Group[]; error?: string };
        if (!res.ok) throw new Error(payload.error ?? "讀取群組失敗。");
        if (cancelled) return;

        const nextGroups = payload.groups ?? [];
        setGroups(nextGroups);
        if (nextGroups.length > 0) setSelectedGroupId(nextGroups[0].lineGroupId);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "LIFF 初始化失敗");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleAsk() {
    const question = input.trim();
    if (!question || !selectedGroupId || !accessToken || asking) return;

    setInput("");
    setAsking(true);
    setMessages((prev) => [...prev, { role: "user", text: question }]);

    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question, lineGroupId: selectedGroupId }),
        cache: "no-store",
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      const answer = res.ok
        ? (data.answer ?? "（無回應）")
        : (data.error ?? "查詢失敗，請稍後再試。");
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "查詢失敗，請確認網路後再試。" },
      ]);
    } finally {
      setAsking(false);
    }
  }

  if (Boolean(LIFF_ID) && status === "loading") return <MascotLoadingScreen />;

  return (
    <main style={mainStyle}>
      <h1 style={titleStyle}>會議記錄查詢</h1>

      {status === "error" && (
        <div style={errorBoxStyle}>{errorMsg}</div>
      )}

      {status === "ready" && (
        <>
          {/* 群組選擇器 */}
          <div style={sectionStyle}>
            <label style={labelStyle}>選擇群組</label>
            <select
              value={selectedGroupId}
              onChange={(e) => {
                if (messages.length > 0 && !window.confirm("切換群組後，目前的對話記錄將會清空，確定要切換嗎？")) return;
                setSelectedGroupId(e.target.value);
                setMessages([]);
              }}
              style={selectStyle}
              aria-label="選擇群組"
            >
              {groups.map((g) => (
                <option key={g.lineGroupId} value={g.lineGroupId}>
                  {g.name?.trim() || "未命名群組"}
                </option>
              ))}
            </select>
          </div>

          {/* 對話區 */}
          <div style={chatBoxStyle}>
            {messages.length === 0 ? (
              <p style={emptyStyle}>請輸入問題，米特寶寶會從歷史會議記錄中為你找答案。</p>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    ...bubbleBaseStyle,
                    ...(msg.role === "user" ? userBubbleStyle : assistantBubbleStyle),
                  }}
                >
                  {msg.text}
                </div>
              ))
            )}
            {asking && (
              <div style={{ ...bubbleBaseStyle, ...assistantBubbleStyle, opacity: 0.6 }}>
                思考中…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 輸入區 */}
          <div style={inputRowStyle}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
              placeholder="輸入問題，例如：上次會議決定了什麼？"
              disabled={asking}
              style={inputStyle}
              aria-label="輸入問題"
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={asking || !input.trim()}
              style={{
                ...sendButtonStyle,
                opacity: asking || !input.trim() ? 0.5 : 1,
                cursor: asking || !input.trim() ? "not-allowed" : "pointer",
              }}
              aria-label="送出問題"
            >
              ➤
            </button>
          </div>
        </>
      )}
    </main>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "1.25rem 1rem 1.75rem",
  background: `linear-gradient(165deg, ${THEME.pageBg} 0%, ${THEME.pageBgAlt} 55%, ${THEME.pageBg} 100%)`,
  color: THEME.text,
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  maxWidth: "600px",
  margin: "0 auto",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.6rem",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: THEME.text,
};

const errorBoxStyle: CSSProperties = {
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  color: THEME.errorText,
  padding: "0.75rem 1rem",
  borderRadius: THEME.radiusControl,
  fontSize: "0.9rem",
};

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const labelStyle: CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 700,
  color: THEME.textMuted,
};

const selectStyle: CSSProperties = {
  width: "100%",
  fontSize: "0.9rem",
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: "12px",
  padding: "0.55rem 0.75rem",
  background: THEME.surface,
  color: THEME.text,
  outline: "none",
  cursor: "pointer",
  boxShadow: THEME.shadowCard,
};

const chatBoxStyle: CSSProperties = {
  flex: 1,
  background: THEME.surface,
  borderRadius: THEME.radiusPanel,
  border: `1px solid ${THEME.surfaceBorder}`,
  padding: "1rem",
  minHeight: "300px",
  maxHeight: "55vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "0.65rem",
  boxShadow: THEME.shadowPanel,
};

const emptyStyle: CSSProperties = {
  margin: "auto",
  textAlign: "center",
  color: THEME.textMuted,
  fontSize: "0.88rem",
  lineHeight: 1.6,
};

const bubbleBaseStyle: CSSProperties = {
  maxWidth: "80%",
  padding: "0.6rem 0.9rem",
  borderRadius: "16px",
  fontSize: "0.9rem",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const userBubbleStyle: CSSProperties = {
  alignSelf: "flex-end",
  background: `rgba(${THEME.accentRgb}, 0.15)`,
  color: THEME.text,
  borderBottomRightRadius: "4px",
};

const assistantBubbleStyle: CSSProperties = {
  alignSelf: "flex-start",
  background: THEME.surfaceSubtle,
  border: `1px solid ${THEME.surfaceBorder}`,
  color: THEME.text,
  borderBottomLeftRadius: "4px",
};

const inputRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  flex: 1,
  fontSize: "0.9rem",
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: "12px",
  padding: "0.6rem 0.85rem",
  background: THEME.surface,
  color: THEME.text,
  outline: "none",
  boxShadow: THEME.shadowCard,
};

const sendButtonStyle: CSSProperties = {
  width: "2.5rem",
  height: "2.5rem",
  borderRadius: "50%",
  border: "none",
  background: THEME.accent,
  color: "#FFF",
  fontSize: "1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxShadow: `0 4px 12px rgba(${THEME.accentRgb}, 0.35)`,
  transition: "opacity 0.15s",
};
