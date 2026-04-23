"use client";

import liff from "@line/liff";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { initLiffOrThrow } from "@/lib/liff/client";
import { LIFF_ID, MISSING_LIFF_ENV_MSG } from "@/lib/liff/utils";

/** LIFF Dashboard：淺灰質感 + 吉祥物電光藍（#00C2FF） */
const THEME = {
  pageBg: "#F0F2F5",
  pageBgAlt: "#E8EBF0",
  surface: "#FFFFFF",
  surfaceSubtle: "#FAFBFC",
  surfaceBorder: "#D1D9E6",
  accent: "#00C2FF",
  accentRgb: "0, 194, 255",
  selectedBg: "rgba(0, 194, 255, 0.12)",
  todayBg: "rgba(0, 194, 255, 0.07)",
  todayBorder: "rgba(0, 194, 255, 0.42)",
  text: "#2D3436",
  textMuted: "#636E72",
  errorBg: "rgba(231, 76, 60, 0.1)",
  errorBorder: "rgba(231, 76, 60, 0.35)",
  errorText: "#C0392B",
  shadowRaised:
    "0 10px 28px rgba(45, 52, 54, 0.08), 0 2px 8px rgba(45, 52, 54, 0.04)",
  shadowPanel:
    "0 14px 44px rgba(45, 52, 54, 0.1), 0 4px 14px rgba(45, 52, 54, 0.05)",
  shadowCard:
    "0 6px 18px rgba(45, 52, 54, 0.06), 0 1px 4px rgba(45, 52, 54, 0.04)",
  shadowSelected: "0 10px 26px rgba(0, 194, 255, 0.22)",
  radiusPanel: "24px",
  radiusControl: "22px",
  radiusDay: "22px",
  radiusCard: "22px",
  glassBlur: "18px",
} as const;

type Status = "loading" | "loadingEvents" | "ready" | "error";

type DashboardGroup = {
  groupId: number;
  lineGroupId: string;
  name: string | null;
  pictureUrl: string | null;
};

type MeetingItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  owner: string;
  lineGroupId: string;
  groupName: string;
  groupPictureUrl: string | null;
  groupColor: string;
  startsAtIso: string;
};

type DashboardEvent = {
  eventId: number;
  lineGroupId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
  ownerDisplayName: string;
};

type CalendarCell = {
  key: string;
  date: Date;
  inMonth: boolean;
};

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

export default function DashboardLiffPage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>(
    LIFF_ID ? "" : MISSING_LIFF_ENV_MSG
  );
  const { isTablet, isCompact } = useResponsiveFlags();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [groups, setGroups] = useState<DashboardGroup[]>([]);
  const [enabledGroupIds, setEnabledGroupIds] = useState<Record<string, boolean>>(
    {}
  );
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    formatDateKey(new Date())
  );

  useEffect(() => {
    if (!LIFF_ID) return;
    let cancelled = false;
    (async () => {
      try {
        await initLiffOrThrow(LIFF_ID, "dashboard");

        const accessToken = liff.getAccessToken()?.trim();

        if (!accessToken) {
          throw new Error("無法取得 LINE access token。");
        }
        if (cancelled) return;

        setStatus("loadingEvents");

        const range = buildDashboardRange(currentMonth);
        const response = await fetch(
          `/api/dashboard?rangeStart=${encodeURIComponent(
            range.rangeStart
          )}&rangeEnd=${encodeURIComponent(range.rangeEnd)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );

        const payload = (await response.json()) as {
          error?: string;
          groups?: DashboardGroup[];
          events?: DashboardEvent[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "讀取活動失敗");
        }

        const nextGroups = payload.groups ?? [];
        const groupMeta = new Map<string, DashboardGroup>(
          nextGroups.map((group) => [group.lineGroupId, group])
        );
        const nextMeetings = (payload.events ?? [])
          .map((event) => mapEventToMeetingItem(event, groupMeta))
          .filter((x): x is MeetingItem => Boolean(x));
        if (cancelled) return;

        setGroups(nextGroups);
        setEnabledGroupIds((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          return Object.fromEntries(nextGroups.map((g) => [g.lineGroupId, true]));
        });
        setMeetings(nextMeetings);
        if (nextMeetings[0]) {
          setSelectedDateKey(nextMeetings[0].date);
          setCurrentMonth(startOfMonth(parseDateKey(nextMeetings[0].date)));
        } else {
          setSelectedDateKey(formatDateKey(new Date()));
          setCurrentMonth(startOfMonth(new Date()));
        }
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
  }, [currentMonth]);

  const calendarCells = useMemo(
    () => buildCalendarCells(currentMonth),
    [currentMonth]
  );
  const enabledGroupSet = useMemo(
    () =>
      new Set(
        Object.entries(enabledGroupIds)
          .filter(([, enabled]) => enabled)
          .map(([id]) => id)
      ),
    [enabledGroupIds]
  );

  const visibleMeetings = useMemo(
    () => meetings.filter((meeting) => enabledGroupSet.has(meeting.lineGroupId)),
    [meetings, enabledGroupSet]
  );

  const meetingsByDate = useMemo(
    () => groupMeetingsByDate(visibleMeetings),
    [visibleMeetings]
  );
  const selectedMeetings = meetingsByDate[selectedDateKey] ?? [];
  const upcomingMeetings = visibleMeetings
    .filter((meeting) => meeting.date >= formatDateKey(new Date()))
    .sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso))
    .slice(0, 5);

  return (
    <main
      style={{
        ...mainStyle,
        padding: isCompact ? "1rem 0.75rem 1.5rem" : "1.5rem 1rem 2rem",
      }}
    >
      <div
        style={{
          ...containerStyle,
          gridTemplateColumns: isTablet
            ? "minmax(0, 1fr)"
            : "minmax(0, 2fr) minmax(18rem, 1fr)",
        }}
      >
        <section style={panelStyle}>
          <div
            style={{
              ...headerRowStyle,
              flexDirection: isCompact ? "column" : "row",
              alignItems: isCompact ? "flex-start" : "flex-start",
            }}
          >
            <div>
              <h1 style={titleStyle}>Meeting Dashboard</h1>
              <p style={subtitleStyle}>
                顯示你加入的所有群組會議，並可用群組標籤快速篩選。
              </p>
            </div>
            <StatusBadge status={status} />
          </div>

          {status === "error" && <div style={errorBoxStyle}>{errorMsg}</div>}

          {groups.length > 0 && (
            <div style={chipBarStyle}>
              {groups.map((group) => {
                const enabled = enabledGroupIds[group.lineGroupId] ?? true;
                const color = resolveGroupColor(group.lineGroupId);
                return (
                  <button
                    key={group.lineGroupId}
                    type="button"
                    onClick={() =>
                      setEnabledGroupIds((prev) => ({
                        ...prev,
                        [group.lineGroupId]: !(prev[group.lineGroupId] ?? true),
                      }))
                    }
                    style={{
                      ...chipStyle,
                      opacity: enabled ? 1 : 0.5,
                      borderColor: enabled
                        ? `rgba(${THEME.accentRgb}, 0.45)`
                        : THEME.surfaceBorder,
                      boxShadow: enabled
                        ? `0 4px 14px rgba(${THEME.accentRgb}, 0.12)`
                        : THEME.shadowCard,
                    }}
                    aria-pressed={enabled}
                    title={group.name ?? group.lineGroupId}
                  >
                    <GroupAvatar
                      name={group.name ?? "群組"}
                      pictureUrl={group.pictureUrl}
                      color={color}
                    />
                    <span style={chipLabelStyle}>
                      {group.name?.trim() || "未命名群組"}
                    </span>
                    <span style={{ ...chipDotStyle, background: color }} />
                  </button>
                );
              })}
            </div>
          )}

          <div
            style={{
              ...monthBarStyle,
              flexWrap: isCompact ? "wrap" : "nowrap",
            }}
          >
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

          <div style={calendarScrollStyle}>
            <div
              style={{
                ...calendarStyle,
                minWidth: isCompact ? "38rem" : "100%",
              }}
            >
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} style={weekdayStyle}>
                  {label}
                </div>
              ))}
              {calendarCells.map((cell) => {
                const dayKey = formatDateKey(cell.date);
                const dayMeetings = meetingsByDate[dayKey] ?? [];
                const isSelected = selectedDateKey === dayKey;
                const isToday = dayKey === formatDateKey(new Date());
                return (
                  <button
                    key={cell.key}
                    type="button"
                    style={{
                      ...dayCellStyle,
                      minHeight: isCompact ? "4.6rem" : "5.25rem",
                      opacity: cell.inMonth ? 1 : 0.42,
                      borderColor: isSelected
                        ? THEME.accent
                        : isToday
                          ? THEME.todayBorder
                          : THEME.surfaceBorder,
                      background: isSelected
                        ? THEME.selectedBg
                        : isToday
                          ? THEME.todayBg
                          : THEME.surfaceSubtle,
                      boxShadow: isSelected
                        ? THEME.shadowSelected
                        : isToday && !isSelected
                          ? `0 4px 14px rgba(${THEME.accentRgb}, 0.14)`
                          : THEME.shadowCard,
                    }}
                    onClick={() => setSelectedDateKey(dayKey)}
                  >
                    <span style={dayNumberRowStyle}>
                      <span style={dayNumberStyle}>{cell.date.getDate()}</span>
                      {isToday ? (
                        <span style={todayBadgeStyle} aria-hidden>
                          今
                        </span>
                      ) : null}
                    </span>
                    {dayMeetings.length > 0 ? (
                      <div style={markerWrapStyle}>
                        <div style={markerRowStyle}>
                          <span style={markerDotStyle} />
                        </div>
                        <span style={meetingCountStyle}>
                          {dayMeetings.length > 0 ? `${dayMeetings.length} 場` : ""}
                        </span>
                      </div>
                    ) : (
                      <span style={meetingCountStyle} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section style={sideColumnStyle}>
          <div style={panelStyle}>
            <h2 style={sectionTitleStyle}>即將到來</h2>
            {upcomingMeetings.length === 0 ? (
              <p style={emptyStyle}>目前沒有即將到來的會議。</p>
            ) : (
              <div style={stackStyle}>
                {upcomingMeetings.map((meeting) => (
                  <article key={meeting.id} style={meetingCardStyle}>
                    <div style={meetingTimeStyle}>
                      {meeting.date} {meeting.time}
                    </div>
                    <div style={meetingTitleStyle}>{meeting.title}</div>
                    <div style={meetingMetaStyle}>
                      <span style={groupPillStyle}>
                        <span style={{ ...groupPillDotStyle, background: meeting.groupColor }} />
                        {meeting.groupName}
                      </span>
                      <span style={metaDividerStyle}>·</span>
                      {meeting.location} <span style={metaDividerStyle}>·</span>{" "}
                      {meeting.owner}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={sectionTitleStyle}>
              {selectedDateKey} 的會議
            </h2>
            {selectedMeetings.length === 0 ? (
              <p style={emptyStyle}>這一天沒有安排會議。</p>
            ) : (
              <div style={stackStyle}>
                {selectedMeetings
                  .slice()
                  .sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso))
                  .map((meeting) => (
                  <article key={meeting.id} style={meetingCardStyle}>
                    <div style={meetingTimeStyle}>{meeting.time}</div>
                    <div style={meetingTitleStyle}>{meeting.title}</div>
                    <div style={meetingMetaStyle}>{meeting.location}</div>
                    <div style={meetingOwnerStyle}>
                      <span style={groupPillStyle}>
                        <span style={{ ...groupPillDotStyle, background: meeting.groupColor }} />
                        {meeting.groupName}
                      </span>
                      <span style={metaDividerStyle}>·</span> 主持人：{meeting.owner}
                    </div>
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
    status === "ready"
      ? "資料已就緒"
      : status === "loading"
        ? "LIFF 載入中"
        : status === "loadingEvents"
          ? "活動載入中"
          : "LIFF 初始化失敗";
  return (
    <span
      style={{
        ...badgeStyle,
        color: status === "error" ? THEME.errorText : THEME.text,
        borderColor:
          status === "ready"
            ? `rgba(${THEME.accentRgb}, 0.45)`
            : THEME.surfaceBorder,
        background:
          status === "ready"
            ? `rgba(${THEME.accentRgb}, 0.1)`
            : status === "error"
              ? THEME.errorBg
              : THEME.surfaceSubtle,
      }}
    >
      {label}
    </span>
  );
}

function useResponsiveFlags() {
  const [state, setState] = useState({ isTablet: false, isCompact: false });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tabletQuery = window.matchMedia("(max-width: 980px)");
    const compactQuery = window.matchMedia("(max-width: 640px)");
    const update = () =>
      setState({
        isTablet: tabletQuery.matches,
        isCompact: compactQuery.matches,
      });

    update();
    tabletQuery.addEventListener("change", update);
    compactQuery.addEventListener("change", update);
    return () => {
      tabletQuery.removeEventListener("change", update);
      compactQuery.removeEventListener("change", update);
    };
  }, []);

  return state;
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

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
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

function mapEventToMeetingItem(
  event: DashboardEvent,
  groupMeta: Map<string, DashboardGroup>
): MeetingItem | null {
  const group = groupMeta.get(event.lineGroupId) ?? null;
  if (!group) return null;

  const startsAt = new Date(event.startsAt);
  const groupName = group.name?.trim() || "未命名群組";
  return {
    id: `${event.lineGroupId}-${event.eventId}`,
    title: event.title,
    date: formatDateKeyInTimeZone(startsAt, event.timezone),
    time: formatTimeLabelInTimeZone(startsAt, event.timezone),
    location: event.location?.trim() || "未提供地點",
    owner: event.ownerDisplayName,
    lineGroupId: event.lineGroupId,
    groupName,
    groupPictureUrl: group.pictureUrl,
    groupColor: resolveGroupColor(event.lineGroupId),
    startsAtIso: startsAt.toISOString(),
  };
}

function buildDashboardRange(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - 10);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  end.setDate(end.getDate() + 45);
  return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
}

const GROUP_COLORS = [
  "#9EEEFF",
  "#74D8F2",
  "#7C92FF",
  "#B388FF",
  "#FFB4E6",
  "#FFCF66",
  "#7BE0B8",
  "#FF8A7A",
] as const;

function resolveGroupColor(lineGroupId: string): string {
  let hash = 0;
  for (let i = 0; i < lineGroupId.length; i += 1) {
    hash = (hash * 31 + lineGroupId.charCodeAt(i)) >>> 0;
  }
  return GROUP_COLORS[hash % GROUP_COLORS.length] ?? GROUP_COLORS[0];
}

function GroupAvatar({
  name,
  pictureUrl,
  color,
}: {
  name: string;
  pictureUrl: string | null;
  color: string;
}) {
  const initial = name.trim().slice(0, 1) || "G";
  if (pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pictureUrl}
        alt={name}
        style={{ ...avatarStyle, borderColor: color }}
      />
    );
  }
  return (
    <span
      style={{
        ...avatarStyle,
        borderColor: color,
        background: THEME.pageBgAlt,
        color: THEME.text,
      }}
    >
      {initial}
    </span>
  );
}

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function formatTimeLabelInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${hour}:${minute}`;
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "1.5rem 1rem 2rem",
  background: `linear-gradient(165deg, ${THEME.pageBg} 0%, ${THEME.pageBgAlt} 55%, ${THEME.pageBg} 100%)`,
  color: THEME.text,
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
  background: `linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.88) 0%,
    rgba(255, 255, 255, 0.72) 100%
  )`,
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: THEME.radiusPanel,
  padding: "1.25rem",
  backdropFilter: `saturate(1.15) blur(${THEME.glassBlur})`,
  WebkitBackdropFilter: `saturate(1.15) blur(${THEME.glassBlur})`,
  boxShadow: THEME.shadowPanel,
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
  color: THEME.text,
  letterSpacing: "-0.02em",
};

const subtitleStyle: CSSProperties = {
  margin: "0.35rem 0 0",
  color: THEME.textMuted,
  fontSize: "0.92rem",
};

const badgeStyle: CSSProperties = {
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: "999px",
  padding: "0.35rem 0.7rem",
  fontSize: "0.82rem",
  whiteSpace: "nowrap",
  background: THEME.surface,
  color: THEME.textMuted,
  boxShadow: THEME.shadowCard,
};

const errorBoxStyle: CSSProperties = {
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  color: THEME.errorText,
  padding: "0.75rem 1rem",
  borderRadius: THEME.radiusControl,
  marginBottom: "1rem",
  fontSize: "0.9rem",
  boxShadow: THEME.shadowCard,
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
  color: THEME.text,
  fontWeight: 700,
};

const ghostButtonStyle: CSSProperties = {
  background: THEME.surface,
  color: THEME.text,
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: THEME.radiusControl,
  padding: "0.55rem 0.85rem",
  cursor: "pointer",
  fontWeight: 600,
  boxShadow: THEME.shadowCard,
};

const calendarScrollStyle: CSSProperties = {
  overflowX: "auto",
  paddingBottom: "0.25rem",
};

const calendarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: "0.5rem",
};

const weekdayStyle: CSSProperties = {
  textAlign: "center",
  color: THEME.textMuted,
  fontSize: "0.85rem",
  paddingBottom: "0.35rem",
  fontWeight: 600,
};

const dayCellStyle: CSSProperties = {
  minHeight: "5.25rem",
  borderRadius: THEME.radiusDay,
  border: `1px solid ${THEME.surfaceBorder}`,
  padding: "0.6rem",
  color: THEME.text,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "0.35rem",
  cursor: "pointer",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
};

const dayNumberRowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
};

const dayNumberStyle: CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 700,
  color: THEME.text,
};

const todayBadgeStyle: CSSProperties = {
  fontSize: "0.62rem",
  fontWeight: 700,
  lineHeight: 1,
  color: THEME.textMuted,
  background: `rgba(${THEME.accentRgb}, 0.14)`,
  border: `1px solid rgba(${THEME.accentRgb}, 0.28)`,
  borderRadius: "6px",
  padding: "0.15rem 0.28rem",
  letterSpacing: "0.04em",
};

const meetingCountStyle: CSSProperties = {
  fontSize: "0.72rem",
  color: THEME.textMuted,
  textAlign: "left",
  fontWeight: 600,
};

const markerWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  alignItems: "flex-start",
};

const markerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.25rem",
};

const markerDotStyle: CSSProperties = {
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  background: THEME.accent,
  boxShadow: `
    0 0 0 1px rgba(255, 255, 255, 0.65),
    0 0 10px rgba(${THEME.accentRgb}, 0.75),
    0 0 18px rgba(${THEME.accentRgb}, 0.45)
  `,
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 0.9rem",
  fontSize: "1.05rem",
  color: THEME.text,
  fontWeight: 700,
};

const stackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const meetingCardStyle: CSSProperties = {
  borderRadius: THEME.radiusCard,
  border: `1px solid ${THEME.surfaceBorder}`,
  background: THEME.surface,
  padding: "0.85rem 0.9rem",
  boxShadow: THEME.shadowCard,
};

const meetingTimeStyle: CSSProperties = {
  fontSize: "0.82rem",
  color: THEME.accent,
  marginBottom: "0.25rem",
  fontWeight: 700,
};

const meetingTitleStyle: CSSProperties = {
  fontWeight: 700,
  marginBottom: "0.25rem",
  color: THEME.text,
};

const meetingMetaStyle: CSSProperties = {
  fontSize: "0.86rem",
  color: THEME.textMuted,
};

const meetingOwnerStyle: CSSProperties = {
  marginTop: "0.3rem",
  fontSize: "0.82rem",
  color: THEME.text,
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: THEME.textMuted,
};

const chipBarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
  marginBottom: "1rem",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
  padding: "0.45rem 0.65rem",
  borderRadius: "999px",
  border: `1px solid ${THEME.surfaceBorder}`,
  background: THEME.surface,
  color: THEME.text,
  cursor: "pointer",
  fontWeight: 600,
  boxShadow: THEME.shadowCard,
};

const chipLabelStyle: CSSProperties = {
  fontSize: "0.82rem",
  maxWidth: "10rem",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const chipDotStyle: CSSProperties = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  boxShadow: `0 0 0 1px rgba(255,255,255,0.9), 0 0 8px rgba(${THEME.accentRgb}, 0.35)`,
};

const avatarStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  borderRadius: "999px",
  objectFit: "cover",
  border: `1px solid ${THEME.surfaceBorder}`,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: THEME.text,
  flexShrink: 0,
  boxShadow: THEME.shadowCard,
};

const groupPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.2rem 0.5rem",
  borderRadius: "999px",
  border: `1px solid ${THEME.surfaceBorder}`,
  background: THEME.surfaceSubtle,
};

const groupPillDotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
};

const metaDividerStyle: CSSProperties = {
  margin: "0 0.35rem",
  opacity: 0.55,
  color: THEME.textMuted,
};
