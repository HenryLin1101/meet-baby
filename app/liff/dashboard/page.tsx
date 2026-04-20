"use client";

import liff from "@line/liff";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

type Status = "loading" | "ready" | "error";

type MeetingItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  owner: string;
};

type CalendarCell = {
  key: string;
  date: Date;
  inMonth: boolean;
};

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
const MISSING_ENV_MSG = "尚未設定 NEXT_PUBLIC_LIFF_ID，請於環境變數加入 LIFF ID。";
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

export default function DashboardLiffPage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>(
    LIFF_ID ? "" : MISSING_ENV_MSG
  );
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const meetings = useMemo(() => buildFakeMeetings(), []);
  const [selectedDateKey, setSelectedDateKey] = useState(() => meetings[0]?.date ?? formatDateKey(new Date()));

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

  const calendarCells = useMemo(
    () => buildCalendarCells(currentMonth),
    [currentMonth]
  );
  const meetingsByDate = useMemo(() => groupMeetingsByDate(meetings), [meetings]);
  const selectedMeetings = meetingsByDate[selectedDateKey] ?? [];
  const upcomingMeetings = meetings
    .filter((meeting) => meeting.date >= formatDateKey(new Date()))
    .slice(0, 5);

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <section style={panelStyle}>
          <div style={headerRowStyle}>
            <div>
              <h1 style={titleStyle}>Meeting Dashboard</h1>
              <p style={subtitleStyle}>假資料預覽後續會議時程。</p>
            </div>
            <StatusBadge status={status} />
          </div>

          {status === "error" && <div style={errorBoxStyle}>{errorMsg}</div>}

          <div style={monthBarStyle}>
            <button
              type="button"
              style={ghostButtonStyle}
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            >
              上個月
            </button>
            <strong style={monthLabelStyle}>{formatMonthLabel(currentMonth)}</strong>
            <button
              type="button"
              style={ghostButtonStyle}
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              下個月
            </button>
          </div>

          <div style={calendarStyle}>
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} style={weekdayStyle}>
                {label}
              </div>
            ))}
            {calendarCells.map((cell) => {
              const dayKey = formatDateKey(cell.date);
              const dayMeetings = meetingsByDate[dayKey] ?? [];
              const isSelected = selectedDateKey === dayKey;
              return (
                <button
                  key={cell.key}
                  type="button"
                  style={{
                    ...dayCellStyle,
                    opacity: cell.inMonth ? 1 : 0.45,
                    borderColor: isSelected ? "var(--accent)" : "rgba(255,255,255,0.08)",
                    background: isSelected
                      ? "rgba(6, 199, 85, 0.12)"
                      : "rgba(15, 20, 25, 0.55)",
                  }}
                  onClick={() => setSelectedDateKey(dayKey)}
                >
                  <span style={dayNumberStyle}>{cell.date.getDate()}</span>
                  <span style={meetingCountStyle}>
                    {dayMeetings.length > 0 ? `${dayMeetings.length} meeting` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section style={sideColumnStyle}>
          <div style={panelStyle}>
            <h2 style={sectionTitleStyle}>即將到來</h2>
            <div style={stackStyle}>
              {upcomingMeetings.map((meeting) => (
                <article key={meeting.id} style={meetingCardStyle}>
                  <div style={meetingTimeStyle}>
                    {meeting.date} {meeting.time}
                  </div>
                  <div style={meetingTitleStyle}>{meeting.title}</div>
                  <div style={meetingMetaStyle}>
                    {meeting.location} · {meeting.owner}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={sectionTitleStyle}>
              {selectedDateKey} 的會議
            </h2>
            {selectedMeetings.length === 0 ? (
              <p style={emptyStyle}>這一天沒有安排會議。</p>
            ) : (
              <div style={stackStyle}>
                {selectedMeetings.map((meeting) => (
                  <article key={meeting.id} style={meetingCardStyle}>
                    <div style={meetingTimeStyle}>{meeting.time}</div>
                    <div style={meetingTitleStyle}>{meeting.title}</div>
                    <div style={meetingMetaStyle}>{meeting.location}</div>
                    <div style={meetingOwnerStyle}>主持人：{meeting.owner}</div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const label =
    status === "ready" ? "LIFF 已就緒" : status === "loading" ? "LIFF 載入中" : "LIFF 初始化失敗";
  return (
    <span
      style={{
        ...badgeStyle,
        color: status === "error" ? "#ffb4b4" : "var(--text)",
        borderColor:
          status === "ready"
            ? "rgba(6, 199, 85, 0.5)"
            : "rgba(255, 255, 255, 0.12)",
      }}
    >
      {label}
    </span>
  );
}

function buildFakeMeetings(): MeetingItem[] {
  const today = startOfDay(new Date());
  return [
    createMeeting("m1", today, 1, "10:00", "每週專案同步", "會議室 A", "Henry"),
    createMeeting("m2", today, 2, "14:30", "UI Review", "Google Meet", "Yuan"),
    createMeeting("m3", today, 5, "09:30", "需求確認", "會議室 B", "PM Lin"),
    createMeeting("m4", today, 8, "16:00", "Sprint Planning", "Google Meet", "Ivy"),
    createMeeting("m5", today, 11, "11:00", "Demo Rehearsal", "會議室 C", "Mia"),
    createMeeting("m6", today, 15, "15:30", "Roadmap 討論", "Google Meet", "Ryan"),
  ];
}

function createMeeting(
  id: string,
  baseDate: Date,
  offsetDays: number,
  time: string,
  title: string,
  location: string,
  owner: string
): MeetingItem {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + offsetDays);
  return {
    id,
    title,
    date: formatDateKey(date),
    time,
    location,
    owner,
  };
}

function groupMeetingsByDate(meetings: MeetingItem[]): Record<string, MeetingItem[]> {
  return meetings.reduce<Record<string, MeetingItem[]>>((acc, meeting) => {
    acc[meeting.date] ??= [];
    acc[meeting.date].push(meeting);
    return acc;
  }, {});
}

function buildCalendarCells(month: Date): CalendarCell[] {
  const monthStart = startOfMonth(month);
  const firstCell = new Date(monthStart);
  firstCell.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return {
      key: `${date.toISOString()}-${index}`,
      date,
      inMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "1.5rem 1rem 2rem",
};

const containerStyle: CSSProperties = {
  maxWidth: "72rem",
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(18rem, 1fr)",
  gap: "1rem",
};

const sideColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const panelStyle: CSSProperties = {
  background: "rgba(26, 35, 50, 0.85)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "16px",
  padding: "1.25rem",
  backdropFilter: "blur(8px)",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
  alignItems: "flex-start",
  marginBottom: "1rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.5rem",
};

const subtitleStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: "var(--muted)",
  fontSize: "0.92rem",
};

const badgeStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "999px",
  padding: "0.35rem 0.7rem",
  fontSize: "0.82rem",
  whiteSpace: "nowrap",
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

const monthBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1rem",
  gap: "0.75rem",
};

const monthLabelStyle: CSSProperties = {
  fontSize: "1rem",
};

const ghostButtonStyle: CSSProperties = {
  background: "rgba(15, 20, 25, 0.8)",
  color: "var(--text)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  padding: "0.55rem 0.8rem",
  cursor: "pointer",
};

const calendarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: "0.5rem",
};

const weekdayStyle: CSSProperties = {
  textAlign: "center",
  color: "var(--muted)",
  fontSize: "0.85rem",
  paddingBottom: "0.35rem",
};

const dayCellStyle: CSSProperties = {
  minHeight: "5.25rem",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.08)",
  padding: "0.6rem",
  color: "var(--text)",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.35rem",
  cursor: "pointer",
};

const dayNumberStyle: CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 700,
};

const meetingCountStyle: CSSProperties = {
  fontSize: "0.72rem",
  color: "var(--muted)",
  textAlign: "left",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 0.9rem",
  fontSize: "1.05rem",
};

const stackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const meetingCardStyle: CSSProperties = {
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(15, 20, 25, 0.6)",
  padding: "0.85rem 0.9rem",
};

const meetingTimeStyle: CSSProperties = {
  fontSize: "0.82rem",
  color: "var(--accent)",
  marginBottom: "0.25rem",
};

const meetingTitleStyle: CSSProperties = {
  fontWeight: 700,
  marginBottom: "0.25rem",
};

const meetingMetaStyle: CSSProperties = {
  fontSize: "0.86rem",
  color: "var(--muted)",
};

const meetingOwnerStyle: CSSProperties = {
  marginTop: "0.3rem",
  fontSize: "0.82rem",
  color: "var(--text)",
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
};
