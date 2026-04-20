"use client";

import liff from "@line/liff";
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

type Status = "loading" | "ready" | "submitting" | "done" | "error";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
const MISSING_ENV_MSG = "尚未設定 NEXT_PUBLIC_LIFF_ID，請於環境變數加入 LIFF ID。";

export default function MeetingLiffPage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>(
    LIFF_ID ? "" : MISSING_ENV_MSG
  );

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!LIFF_ID) return;
    let cancelled = false;
    (async () => {
      try {
        await liff.init({
          liffId: LIFF_ID,
          withLoginOnExternalBrowser: false,
        });
        if (!cancelled) setStatus("ready");
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

    const summary = buildSummary({ title, date, time, location, note });
    setStatus("submitting");

    try {
      if (liff.isInClient()) {
        await liff.sendMessages([{ type: "text", text: summary }]);
        setStatus("done");
        liff.closeWindow();
        return;
      }
      window.alert("（非 LINE 內開啟，僅模擬送出）\n\n" + summary);
      setStatus("done");
    } catch (err) {
      setStatus("ready");
      window.alert("送出失敗：" + (err instanceof Error ? err.message : "unknown"));
    }
  }

  const disabled = status !== "ready";

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>預約會議</h1>
        <p style={subtitleStyle}>
          填好下方資訊送出，會直接在聊天室留下會議摘要。
        </p>

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

          <Row>
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

          <button
            type="submit"
            style={{
              ...buttonStyle,
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
            disabled={disabled}
          >
            {status === "submitting"
              ? "送出中…"
              : status === "done"
                ? "已送出"
                : status === "loading"
                  ? "載入中…"
                  : "送出"}
          </button>
        </form>
      </div>
    </main>
  );
}

function buildSummary(input: {
  title: string;
  date: string;
  time: string;
  location: string;
  note: string;
}): string {
  const lines = [
    "【會議預約】",
    `主題：${input.title}`,
    `時間：${input.date} ${input.time}`,
  ];
  if (input.location.trim()) lines.push(`地點：${input.location.trim()}`);
  if (input.note.trim()) lines.push(`備註：${input.note.trim()}`);
  return lines.join("\n");
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

function Row({ children }: { children: ReactNode }) {
  return <div style={rowStyle}>{children}</div>;
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  padding: "2rem 1rem",
};

const cardStyle: CSSProperties = {
  maxWidth: "32rem",
  width: "100%",
  background: "rgba(26, 35, 50, 0.85)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "16px",
  padding: "1.75rem",
  backdropFilter: "blur(8px)",
};

const titleStyle: CSSProperties = {
  margin: "0 0 0.5rem",
  fontSize: "1.5rem",
};

const subtitleStyle: CSSProperties = {
  margin: "0 0 1.5rem",
  color: "var(--muted)",
  fontSize: "0.9rem",
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
  background: "rgba(15, 20, 25, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "10px",
  color: "var(--text)",
  padding: "0.625rem 0.75rem",
  fontSize: "1rem",
  fontFamily: "inherit",
  width: "100%",
};

const buttonStyle: CSSProperties = {
  marginTop: "0.5rem",
  background: "var(--accent)",
  color: "#0b1b11",
  border: 0,
  borderRadius: "10px",
  padding: "0.75rem 1rem",
  fontSize: "1rem",
  fontWeight: 600,
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
