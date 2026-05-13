"use client";

import liff from "@line/liff";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { initLiffOrThrow } from "@/lib/liff/client";
import MascotLoadingScreen from "@/lib/liff/MascotLoadingScreen";
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

type TodoItem = {
  id: number;
  summaryId: number | null;
  groupId: number;
  lineGroupId: string;
  groupName: string;
  meetingTitle: string;
  item: string;
  owner: string;
  assignedUsers: { userId: number; displayName: string }[];
  due: string;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
};

type TodoGroupMember = {
  userId: number;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
};

type CalendarCell =
  | { kind: "pad"; key: string }
  | { kind: "day"; key: string; date: Date };

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

export default function DashboardLiffPage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>(
    LIFF_ID ? "" : MISSING_LIFF_ENV_MSG
  );
  const { isCompact } = useResponsiveFlags();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [groups, setGroups] = useState<DashboardGroup[]>([]);
  const [enabledGroupIds, setEnabledGroupIds] = useState<Record<string, boolean>>(
    {}
  );
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    formatDateKey(new Date())
  );
  const [lineAccessToken, setLineAccessToken] = useState<string | null>(null);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string>("");
  const [todoScope, setTodoScope] = useState<"all" | "mine">("all");
  const [groupMembers, setGroupMembers] = useState<Record<string, TodoGroupMember[]>>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [newTodoGroupId, setNewTodoGroupId] = useState<string>("");
  const [newTodoDue, setNewTodoDue] = useState("");
  const [newTodoAssignees, setNewTodoAssignees] = useState<number[]>([]);
  const [addingTodo, setAddingTodo] = useState(false);
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);

  useEffect(() => {
    if (showAddTodoModal) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [showAddTodoModal]);

  /** 避免每次 refetch 都把選取日期覆寫成 API 陣列第一筆（例如固定跳回 4/21） */
  const didApplyInitialSelection = useRef(false);

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
        setLineAccessToken(accessToken);
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
        setNewTodoGroupId((prev) =>
          prev || (nextGroups.length > 0 ? nextGroups[0].lineGroupId : "")
        );
        setMeetings(nextMeetings);

        if (!didApplyInitialSelection.current) {
          didApplyInitialSelection.current = true;
          if (nextMeetings.length > 0) {
            const sorted = [...nextMeetings].sort((a, b) =>
              a.startsAtIso.localeCompare(b.startsAtIso)
            );
            const first = sorted[0];
            setSelectedDateKey(first.date);
            const m = startOfMonth(parseDateKey(first.date));
            setCurrentMonth((prev) =>
              prev.getFullYear() === m.getFullYear() && prev.getMonth() === m.getMonth()
                ? prev
                : m
            );
          } else {
            const today = new Date();
            setSelectedDateKey(formatDateKey(today));
            const m = startOfMonth(today);
            setCurrentMonth((prev) =>
              prev.getFullYear() === m.getFullYear() && prev.getMonth() === m.getMonth()
                ? prev
                : m
            );
          }
        } else {
          setSelectedDateKey((prev) => {
            const d = parseDateKey(prev);
            const cm = currentMonth;
            if (d.getFullYear() === cm.getFullYear() && d.getMonth() === cm.getMonth()) {
              return prev;
            }
            const now = new Date();
            if (
              now.getFullYear() === cm.getFullYear() &&
              now.getMonth() === cm.getMonth()
            ) {
              return formatDateKey(now);
            }
            return formatDateKey(new Date(cm.getFullYear(), cm.getMonth(), 1));
          });
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

  useEffect(() => {
    if (!lineAccessToken || groups.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const [todoRes, ...memberResults] = await Promise.all([
          fetch("/api/todo-items", {
            headers: { Authorization: `Bearer ${lineAccessToken}` },
            cache: "no-store",
          }),
          ...groups.map((g) =>
            fetch(
              `/api/group-members?groupId=${encodeURIComponent(g.lineGroupId)}`,
              {
                headers: { Authorization: `Bearer ${lineAccessToken}` },
                cache: "no-store",
              }
            )
          ),
        ]);
        if (cancelled) return;

        const todoData = (await todoRes.json()) as {
          todoItems?: TodoItem[];
          currentUserId?: number;
          currentUserDisplayName?: string;
        };
        if (todoRes.ok && todoData.todoItems) {
          setTodoItems(todoData.todoItems);
          if (todoData.currentUserId != null) {
            setCurrentUserId(todoData.currentUserId);
          }
          if (todoData.currentUserDisplayName) {
            setCurrentUserDisplayName(todoData.currentUserDisplayName);
          }
        }

        const membersMap: Record<string, TodoGroupMember[]> = {};
        for (let i = 0; i < groups.length; i++) {
          const res = memberResults[i];
          if (!res.ok) continue;
          const data = (await res.json()) as {
            members?: TodoGroupMember[];
          };
          if (data.members) {
            membersMap[groups[i].lineGroupId] = data.members;
          }
        }
        if (!cancelled) setGroupMembers(membersMap);
      } catch (err) {
        console.error("[dashboard.todo-items]", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lineAccessToken, groups]);

  async function handleToggleTodo(id: number, isCompleted: boolean) {
    if (!lineAccessToken) return;
    setTodoItems((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, isCompleted, completedAt: isCompleted ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      const res = await fetch(`/api/todo-items/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${lineAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isCompleted }),
      });
      if (!res.ok) {
        setTodoItems((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isCompleted: !isCompleted } : t))
        );
      }
    } catch {
      setTodoItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isCompleted: !isCompleted } : t))
      );
    }
  }

  async function handleDeleteTodo(id: number) {
    if (!lineAccessToken) return;
    const backup = todoItems;
    setTodoItems((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/todo-items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${lineAccessToken}` },
      });
      if (!res.ok) setTodoItems(backup);
    } catch {
      setTodoItems(backup);
    }
  }

  async function handleUpdateTodoDue(id: number, due: string) {
    if (!lineAccessToken) return;
    const prev = todoItems.find((t) => t.id === id);
    if (!prev) return;
    setTodoItems((items) => items.map((t) => (t.id === id ? { ...t, due } : t)));
    try {
      const res = await fetch(`/api/todo-items/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${lineAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ due }),
      });
      if (!res.ok) {
        setTodoItems((items) =>
          items.map((t) => (t.id === id ? { ...t, due: prev.due } : t))
        );
      }
    } catch {
      setTodoItems((items) =>
        items.map((t) => (t.id === id ? { ...t, due: prev.due } : t))
      );
    }
  }

  async function handleAddTodo() {
    if (!lineAccessToken || !newTodoText.trim() || !newTodoGroupId) return;
    const group = groups.find((g) => g.lineGroupId === newTodoGroupId);
    if (!group) return;
    setAddingTodo(true);
    try {
      const payload: Record<string, unknown> = {
        groupId: group.groupId,
        item: newTodoText.trim(),
      };
      if (newTodoDue) payload.due = newTodoDue;
      if (newTodoAssignees.length > 0) payload.assignedUserIds = newTodoAssignees;

      const res = await fetch("/api/todo-items", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lineAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json()) as { todoItem?: TodoItem };
        if (data.todoItem) {
          setTodoItems((prev) => [...prev, data.todoItem!]);
        }
        setNewTodoText("");
        setNewTodoDue("");
        setNewTodoAssignees([]);
        setShowAddTodoModal(false);
      } else {
        console.error("[dashboard.addTodo]", await res.text());
      }
    } catch (err) {
      console.error("[dashboard.addTodo]", err);
    } finally {
      setAddingTodo(false);
    }
  }

  async function handleUpdateTodoText(id: number, item: string) {
    if (!lineAccessToken || !item.trim()) return;
    const prev = todoItems.find((t) => t.id === id);
    if (!prev) return;
    setTodoItems((items) => items.map((t) => (t.id === id ? { ...t, item } : t)));
    try {
      const res = await fetch(`/api/todo-items/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${lineAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ item }),
      });
      if (!res.ok) {
        setTodoItems((items) =>
          items.map((t) => (t.id === id ? { ...t, item: prev.item } : t))
        );
      }
    } catch {
      setTodoItems((items) =>
        items.map((t) => (t.id === id ? { ...t, item: prev.item } : t))
      );
    }
  }

  async function handleUpdateTodoAssignees(id: number, assignedUserIds: number[]) {
    if (!lineAccessToken) return;
    const prev = todoItems.find((t) => t.id === id);
    if (!prev) return;
    try {
      const res = await fetch(`/api/todo-items/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${lineAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignedUserIds }),
      });
      if (res.ok) {
        const data = (await res.json()) as { todoItem?: TodoItem };
        if (data.todoItem) {
          setTodoItems((items) =>
            items.map((t) => (t.id === id ? data.todoItem! : t))
          );
        }
      }
    } catch {
      // keep previous state
    }
  }

  async function handleUpdateTodoGroup(id: number, newLineGroupId: string) {
    if (!lineAccessToken) return;
    const group = groups.find((g) => g.lineGroupId === newLineGroupId);
    if (!group) return;
    const prev = todoItems.find((t) => t.id === id);
    if (!prev) return;
    try {
      const res = await fetch(`/api/todo-items/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${lineAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ groupId: group.groupId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { todoItem?: TodoItem };
        if (data.todoItem) {
          setTodoItems((items) =>
            items.map((t) => (t.id === id ? data.todoItem! : t))
          );
        }
      }
    } catch {
      // keep previous state
    }
  }

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

  const pendingTodos = useMemo(
    () =>
      todoItems.filter(
        (t) =>
          !t.isCompleted &&
          enabledGroupSet.has(t.lineGroupId) &&
          (todoScope === "all" ||
            t.assignedUsers.some((u) => u.userId === currentUserId) ||
            (currentUserDisplayName !== "" && t.owner === currentUserDisplayName))
      ),
    [todoItems, enabledGroupSet, todoScope, currentUserId, currentUserDisplayName]
  );
  const completedTodos = useMemo(
    () =>
      todoItems.filter(
        (t) =>
          t.isCompleted &&
          enabledGroupSet.has(t.lineGroupId) &&
          (todoScope === "all" ||
            t.assignedUsers.some((u) => u.userId === currentUserId) ||
            (currentUserDisplayName !== "" && t.owner === currentUserDisplayName))
      ),
    [todoItems, enabledGroupSet, todoScope, currentUserId, currentUserDisplayName]
  );

  const showBlockingLoader =
    Boolean(LIFF_ID) && (status === "loading" || status === "loadingEvents");

  return (
    <>
      {showBlockingLoader && <MascotLoadingScreen />}
      {!showBlockingLoader && (
    <main
      style={{
        ...mainStyle,
        padding: isCompact ? "0.75rem 0.65rem 1.25rem" : "1.25rem 1rem 1.75rem",
      }}
    >
      <div
        style={{
          ...containerStyle,
          gridTemplateColumns: "minmax(0, 1fr)",
        }}
      >
        <div style={calendarColumnStyle}>
          <h1
            style={{
              ...heroTitleStyle,
              fontSize: isCompact ? "2.1rem" : "2.5rem",
            }}
          >
            Meeting Dashboard
          </h1>

          {status === "error" && <div style={errorBoxStyle}>{errorMsg}</div>}

          {groups.length > 0 && (
            <div style={filterBlockStyle}>
              <p style={filterSectionLabelStyle}>群組篩選</p>
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
            </div>
          )}

          <div style={calendarSheetStyle}>
            <div style={monthBarStyle}>
              <button
                type="button"
                style={monthArrowButtonStyle}
                onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                aria-label="上個月"
              >
                <span style={monthArrowGlyphStyle} aria-hidden>
                  ‹
                </span>
              </button>
              <button
                type="button"
                style={monthArrowButtonStyle}
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                aria-label="下個月"
              >
                <span style={monthArrowGlyphStyle} aria-hidden>
                  ›
                </span>
              </button>
            </div>
            <h2 style={monthHeadingStyle}>{formatMonthLabel(currentMonth)}</h2>

            <div style={calendarGridWrapStyle}>
              <div style={calendarStyle}>
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} style={weekdayStyle}>
                    {label}
                  </div>
                ))}
                {calendarCells.map((cell) => {
                  if (cell.kind === "pad") {
                    return (
                      <div key={cell.key} style={calendarPadCellStyle} aria-hidden />
                    );
                  }
                  const dayKey = formatDateKey(cell.date);
                  const dayMeetings = meetingsByDate[dayKey] ?? [];
                  const isSelected = selectedDateKey === dayKey;
                  const isToday = dayKey === formatDateKey(new Date());
                  const markerColors = buildGroupMarkers(dayMeetings);
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      style={dayCellMinimalStyle}
                      onClick={() => setSelectedDateKey(dayKey)}
                      aria-pressed={isSelected}
                      aria-label={`${formatMonthDayLabel(cell.date)}${dayMeetings.length ? `，${dayMeetings.length} 場會議` : ""}`}
                    >
                      <span
                        style={{
                          ...dayNumberDiscStyle,
                          background: isSelected ? THEME.accent : "transparent",
                          color: isSelected ? "#FFFFFF" : THEME.text,
                          fontWeight: isToday ? 800 : 700,
                          boxShadow:
                            isToday && !isSelected
                              ? `inset 0 0 0 1.5px rgba(${THEME.accentRgb}, 0.35)`
                              : "none",
                        }}
                      >
                        {cell.date.getDate()}
                      </span>
                      {markerColors.length > 0 ? (
                        <div style={eventDotsRowStyle}>
                          {markerColors.slice(0, 4).map((c, idx) => (
                            <span
                              key={`${dayKey}-dot-${idx}-${c}`}
                              style={{ ...eventDotMiniStyle, background: c }}
                            />
                          ))}
                        </div>
                      ) : (
                        <span style={eventDotsPlaceholderStyle} aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={sectionTitleStyle}>{selectedDateKey} 的會議</h2>
            {selectedMeetings.length === 0 ? (
              <p style={emptyStyle}>這一天沒有安排會議，要陪米特寶寶聊聊天嗎？</p>
            ) : (
              <div style={stackStyle}>
                {selectedMeetings
                  .slice()
                  .sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso))
                  .map((meeting) => {
                    const locationText = meeting.location?.trim() ?? "";
                    const hasLocation =
                      Boolean(locationText) && locationText !== "未提供地點";
                    return (
                    <article key={meeting.id} style={meetingCardCompactStyle}>
                      <div style={meetingTitleStyle}>{meeting.title}</div>
                      <div style={meetingCompactRowStyle}>
                        <span
                          style={{
                            ...groupPillDotStyle,
                            background: meeting.groupColor,
                            marginRight: "0.35rem",
                          }}
                        />
                        <span style={meetingCompactMetaStyle}>{meeting.groupName}</span>
                      </div>
                      <div style={meetingCompactMetaStyle}>{meeting.time}</div>
                      {hasLocation ? (
                        <div style={meetingCompactMetaStyle}>{locationText}</div>
                      ) : null}
                    </article>
                    );
                  })}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={sectionTitleStyle}>即將到來</h2>
            {upcomingMeetings.length === 0 ? (
              <p style={emptyStyle}>目前沒有即將到來的會議。</p>
            ) : (
              <div style={stackStyle}>
                {upcomingMeetings.map((meeting) => (
                  <article key={meeting.id} style={meetingCardCompactStyle}>
                    <div style={meetingTitleStyle}>{meeting.title}</div>
                    <div style={meetingCompactRowStyle}>
                      <span
                        style={{
                          ...groupPillDotStyle,
                          background: meeting.groupColor,
                          marginRight: "0.35rem",
                        }}
                      />
                      <span style={meetingCompactMetaStyle}>{meeting.groupName}</span>
                    </div>
                    <div style={meetingCompactMetaStyle}>
                      {meeting.date} {meeting.time}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
              <h2 style={{ ...sectionTitleStyle, margin: 0 }}>待辦事項</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowAddTodoModal(true)}
                  style={{
                    background: THEME.accent,
                    color: "#FFF",
                    border: "none",
                    borderRadius: "50%",
                    width: "28px",
                    height: "28px",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                    boxShadow: "0 2px 8px rgba(0, 194, 255, 0.3)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  aria-label="新增待辦事項"
                >
                  +
                </button>
                <div style={{ display: "inline-flex", borderRadius: "999px", overflow: "hidden", border: `1px solid ${THEME.surfaceBorder}`, background: THEME.surfaceSubtle }}>
                  {(["all", "mine"] as const).map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setTodoScope(scope)}
                      aria-pressed={todoScope === scope}
                      style={{
                        border: "none",
                        padding: "0.22rem 0.65rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        background: todoScope === scope ? THEME.accent : "transparent",
                        color: todoScope === scope ? "#FFF" : THEME.textMuted,
                        transition: "background 0.15s, color 0.15s",
                      }}
                    >
                      {scope === "all" ? "全部" : "我的"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {showAddTodoModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0, 0, 0, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 9999,
                  padding: "1rem",
                  touchAction: "none",
                  overscrollBehavior: "contain",
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowAddTodoModal(false);
                }}
                onTouchMove={(e) => e.preventDefault()}
              >
                <div
                  style={{
                    background: THEME.surface,
                    borderRadius: THEME.radiusPanel,
                    padding: "1.5rem",
                    width: "100%",
                    maxWidth: "380px",
                    boxShadow: THEME.shadowPanel,
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: THEME.text }}>
                      新增待辦事項
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddTodoModal(false)}
                      style={{
                        border: "none",
                        background: "transparent",
                        fontSize: "1.2rem",
                        color: THEME.textMuted,
                        cursor: "pointer",
                        padding: "0.2rem",
                        lineHeight: 1,
                      }}
                      aria-label="關閉"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div>
                      <label style={modalLabelStyle}>待辦事項</label>
                      <input
                        type="text"
                        value={newTodoText}
                        onChange={(e) => setNewTodoText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddTodo();
                        }}
                        placeholder="輸入待辦事項內容…"
                        autoFocus
                        style={modalFieldStyle}
                      />
                    </div>

                    <div>
                      <label style={modalLabelStyle}>群組</label>
                      <select
                        value={newTodoGroupId}
                        onChange={(e) => {
                          setNewTodoGroupId(e.target.value);
                          setNewTodoAssignees([]);
                        }}
                        style={modalFieldStyle}
                        aria-label="選擇群組"
                      >
                        <option value="">選擇群組</option>
                        {groups.map((g) => (
                          <option key={g.lineGroupId} value={g.lineGroupId}>
                            {g.name?.trim() || "未命名群組"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={modalLabelStyle}>截止日期</label>
                      <div style={{ position: "relative" }}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={THEME.textMuted}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                        >
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <input
                          type="date"
                          value={newTodoDue}
                          onChange={(e) => setNewTodoDue(e.target.value)}
                          style={{ ...modalFieldStyle, paddingLeft: "2.2rem" }}
                          aria-label="截止日期"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={modalLabelStyle}>指派成員</label>
                      <select
                        value=""
                        onChange={(e) => {
                          const uid = Number(e.target.value);
                          if (uid && !newTodoAssignees.includes(uid)) {
                            setNewTodoAssignees((prev) => [...prev, uid]);
                          }
                        }}
                        style={modalFieldStyle}
                        aria-label="指派成員"
                        disabled={!newTodoGroupId}
                      >
                        <option value="">{newTodoGroupId ? "選擇成員" : "請先選擇群組"}</option>
                        {(groupMembers[newTodoGroupId] ?? [])
                          .filter((m) => !newTodoAssignees.includes(m.userId))
                          .map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.displayName}
                            </option>
                          ))}
                      </select>
                      {newTodoAssignees.length > 0 && (
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                          {newTodoAssignees.map((uid) => {
                            const m = (groupMembers[newTodoGroupId] ?? []).find((x) => x.userId === uid);
                            return (
                              <span key={uid} style={assigneeChipStyle}>
                                {m?.displayName ?? "?"}
                                <button
                                  type="button"
                                  onClick={() => setNewTodoAssignees((prev) => prev.filter((id) => id !== uid))}
                                  style={assigneeChipRemoveStyle}
                                >
                                  ✕
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddTodo}
                    disabled={addingTodo || !newTodoText.trim() || !newTodoGroupId}
                    style={{
                      background: THEME.accent,
                      color: "#FFF",
                      border: "none",
                      borderRadius: "12px",
                      padding: "0.65rem",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      cursor: addingTodo || !newTodoText.trim() || !newTodoGroupId ? "not-allowed" : "pointer",
                      opacity: addingTodo || !newTodoText.trim() || !newTodoGroupId ? 0.5 : 1,
                      marginTop: "0.25rem",
                      transition: "opacity 0.15s",
                    }}
                  >
                    {addingTodo ? "新增中…" : "新增"}
                  </button>
                </div>
              </div>
            )}

            {pendingTodos.length === 0 ? (
              <p style={emptyStyle}>目前沒有未完成的待辦事項。</p>
            ) : (
              <div style={stackStyle}>
                {pendingTodos.map((todo) => (
                  <TodoItemCard
                    key={todo.id}
                    todo={todo}
                    groups={groups}
                    groupColor={resolveGroupColor(todo.lineGroupId)}
                    members={groupMembers[todo.lineGroupId] ?? []}
                    onToggle={() => handleToggleTodo(todo.id, true)}
                    onDelete={() => handleDeleteTodo(todo.id)}
                    onUpdateDue={(due) => handleUpdateTodoDue(todo.id, due)}
                    onUpdateAssignees={(uids) => handleUpdateTodoAssignees(todo.id, uids)}
                    onUpdateText={(text) => handleUpdateTodoText(todo.id, text)}
                    onUpdateGroup={(gid) => handleUpdateTodoGroup(todo.id, gid)}
                  />
                ))}
              </div>
            )}

            {completedTodos.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCompleted((v) => !v)}
                  style={completedToggleStyle}
                >
                  {showCompleted ? "▾" : "▸"} 已完成（{completedTodos.length}）
                </button>
                {showCompleted && (
                  <div style={{ ...stackStyle, marginTop: "0.5rem" }}>
                    {completedTodos.map((todo) => (
                      <TodoItemCard
                        key={todo.id}
                        todo={todo}
                        groups={groups}
                        groupColor={resolveGroupColor(todo.lineGroupId)}
                        members={groupMembers[todo.lineGroupId] ?? []}
                        onToggle={() => handleToggleTodo(todo.id, false)}
                        onDelete={() => handleDeleteTodo(todo.id)}
                        onUpdateDue={(due) => handleUpdateTodoDue(todo.id, due)}
                        onUpdateAssignees={(uids) => handleUpdateTodoAssignees(todo.id, uids)}
                        onUpdateText={(text) => handleUpdateTodoText(todo.id, text)}
                        onUpdateGroup={(gid) => handleUpdateTodoGroup(todo.id, gid)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
      )}
    </>
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

/** 僅當月 1 日～末日；前後以空白格對齊週列，不顯示其他月份日期。 */
function buildCalendarCells(month: Date): CalendarCell[] {
  const monthStart = startOfMonth(month);
  const y = monthStart.getFullYear();
  const m = monthStart.getMonth();
  const startDow = monthStart.getDay();
  const lastDay = new Date(y, m + 1, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < startDow; i += 1) {
    cells.push({ kind: "pad", key: `pad-${y}-${m}-lead-${i}` });
  }
  for (let d = 1; d <= lastDay; d += 1) {
    cells.push({ kind: "day", key: `day-${y}-${m}-${d}`, date: new Date(y, m, d) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ kind: "pad", key: `pad-${y}-${m}-trail-${cells.length}` });
  }
  return cells;
}

function buildGroupMarkers(meetings: MeetingItem[]): string[] {
  const colors = new Set<string>();
  for (const meeting of meetings) {
    colors.add(meeting.groupColor);
  }
  return [...colors];
}

function formatMonthDayLabel(date: Date): string {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
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

const surfaceCardStyle: CSSProperties = {
  background: `linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.92) 0%,
    rgba(255, 255, 255, 0.78) 100%
  )`,
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: THEME.radiusPanel,
  backdropFilter: `saturate(1.15) blur(${THEME.glassBlur})`,
  WebkitBackdropFilter: `saturate(1.15) blur(${THEME.glassBlur})`,
  boxShadow: THEME.shadowPanel,
};

const panelStyle: CSSProperties = {
  ...surfaceCardStyle,
  padding: "1.25rem",
};

const calendarColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  minWidth: 0,
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: THEME.text,
  letterSpacing: "-0.03em",
  fontWeight: 800,
  lineHeight: 1.15,
};

const filterBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.45rem",
};

const filterSectionLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.78rem",
  fontWeight: 700,
  color: THEME.textMuted,
  letterSpacing: "0.02em",
};

/** 行事曆區：白底、無標題／群組外框，風格貼近極簡月曆 */
const calendarSheetStyle: CSSProperties = {
  background: THEME.surface,
  borderRadius: THEME.radiusPanel,
  padding: "0.85rem 0.55rem 1rem",
  border: `1px solid ${THEME.surfaceBorder}`,
  boxShadow: THEME.shadowCard,
};

const errorBoxStyle: CSSProperties = {
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  color: THEME.errorText,
  padding: "0.75rem 1rem",
  borderRadius: THEME.radiusControl,
  marginBottom: 0,
  fontSize: "0.9rem",
  boxShadow: THEME.shadowCard,
};

const monthBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.35rem",
  gap: "0.5rem",
};

const monthHeadingStyle: CSSProperties = {
  margin: "0 0 0.65rem",
  fontSize: "1.35rem",
  fontWeight: 800,
  color: THEME.text,
  letterSpacing: "-0.02em",
};

const monthArrowButtonStyle: CSSProperties = {
  width: "2.35rem",
  height: "2.35rem",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: THEME.radiusControl,
  border: `1px solid ${THEME.surfaceBorder}`,
  background: THEME.surfaceSubtle,
  color: THEME.text,
  cursor: "pointer",
  boxShadow: THEME.shadowCard,
  padding: 0,
};

const monthArrowGlyphStyle: CSSProperties = {
  fontSize: "1.35rem",
  lineHeight: 1,
  fontWeight: 300,
  marginTop: "-0.05em",
};

const calendarGridWrapStyle: CSSProperties = {
  width: "100%",
  overflow: "visible",
};

const calendarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: "0.15rem 0.1rem",
  width: "100%",
};

const weekdayStyle: CSSProperties = {
  textAlign: "center",
  color: THEME.textMuted,
  fontSize: "0.7rem",
  paddingBottom: "0.2rem",
  fontWeight: 600,
  letterSpacing: "0.02em",
};

const calendarPadCellStyle: CSSProperties = {
  minHeight: "3rem",
};

const dayCellMinimalStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: "0.15rem 0.05rem",
  minHeight: "3rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "0.2rem",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  color: THEME.text,
};

const dayNumberDiscStyle: CSSProperties = {
  width: "1.85rem",
  height: "1.85rem",
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.84rem",
  lineHeight: 1,
  transition: "background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
};

const eventDotsRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.18rem",
  minHeight: "0.45rem",
};

const eventDotMiniStyle: CSSProperties = {
  width: "5px",
  height: "5px",
  borderRadius: "999px",
  flexShrink: 0,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.85)",
};

const eventDotsPlaceholderStyle: CSSProperties = {
  display: "block",
  minHeight: "0.45rem",
  width: "100%",
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

const meetingCardCompactStyle: CSSProperties = {
  borderRadius: THEME.radiusCard,
  border: `1px solid ${THEME.surfaceBorder}`,
  background: THEME.surface,
  padding: "0.65rem 0.75rem",
  boxShadow: THEME.shadowCard,
};

const meetingTitleStyle: CSSProperties = {
  fontWeight: 700,
  marginBottom: "0.35rem",
  color: THEME.text,
  fontSize: "0.92rem",
};

const meetingCompactRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: "0.2rem",
};

const meetingCompactMetaStyle: CSSProperties = {
  fontSize: "0.8rem",
  color: THEME.textMuted,
  lineHeight: 1.35,
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: THEME.textMuted,
};

const chipBarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.45rem",
  marginBottom: 0,
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

const groupPillDotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  flexShrink: 0,
};

const completedToggleStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: THEME.textMuted,
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 600,
  padding: "0.5rem 0 0",
  marginTop: "0.5rem",
};

const todoDeleteBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: THEME.textMuted,
  cursor: "pointer",
  fontSize: "1.15rem",
  padding: "0.35rem 0.45rem",
  borderRadius: "8px",
  flexShrink: 0,
  lineHeight: 1,
};

const todoMetaStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: THEME.textMuted,
  display: "inline-flex",
  alignItems: "center",
  gap: "0.2rem",
};

const modalLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.78rem",
  fontWeight: 600,
  color: THEME.textMuted,
  marginBottom: "0.3rem",
};

const modalFieldStyle: CSSProperties = {
  width: "100%",
  fontSize: "0.88rem",
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: "10px",
  padding: "0.5rem 0.65rem",
  outline: "none",
  background: THEME.surfaceSubtle,
  color: THEME.text,
  boxSizing: "border-box",
  cursor: "pointer",
};

const todoSelectStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: THEME.textMuted,
  background: "transparent",
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: "8px",
  padding: "0.15rem 0.35rem",
  cursor: "pointer",
  maxWidth: "8rem",
};

const todoDateInputStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: THEME.textMuted,
  background: "transparent",
  border: `1px solid ${THEME.surfaceBorder}`,
  borderRadius: "8px",
  padding: "0.15rem 0.35rem",
  cursor: "pointer",
};

const assigneeChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.2rem",
  fontSize: "0.72rem",
  color: THEME.text,
  background: `rgba(${THEME.accentRgb}, 0.12)`,
  borderRadius: "12px",
  padding: "0.1rem 0.45rem",
  lineHeight: 1.4,
};

const assigneeChipRemoveStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: THEME.textMuted,
  cursor: "pointer",
  fontSize: "0.6rem",
  padding: "0 0.1rem",
  lineHeight: 1,
};

function TodoItemCard({
  todo,
  groups,
  groupColor,
  members,
  onToggle,
  onDelete,
  onUpdateDue,
  onUpdateAssignees,
  onUpdateText,
  onUpdateGroup,
}: {
  todo: TodoItem;
  groups: DashboardGroup[];
  groupColor: string;
  members: TodoGroupMember[];
  onToggle: () => void;
  onDelete: () => void;
  onUpdateDue: (due: string) => void;
  onUpdateAssignees: (userIds: number[]) => void;
  onUpdateText: (text: string) => void;
  onUpdateGroup: (lineGroupId: string) => void;
}) {
  const [cardEditing, setCardEditing] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [editText, setEditText] = useState(todo.item);
  const currentIds = todo.assignedUsers.map((u) => u.userId);

  const groupName = groups.find((g) => g.lineGroupId === todo.lineGroupId)?.name?.trim() || "未命名群組";

  function commitEdit() {
    const trimmed = editText.trim();
    setEditingText(false);
    if (trimmed && trimmed !== todo.item) {
      onUpdateText(trimmed);
    } else {
      setEditText(todo.item);
    }
  }

  const dueDateDisplay = todo.due && /^\d{4}-\d{2}-\d{2}/.test(todo.due)
    ? todo.due.slice(0, 10)
    : "";

  return (
    <article
      style={{
        ...meetingCardCompactStyle,
        display: "flex",
        alignItems: "flex-start",
        gap: "0.55rem",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={todo.isCompleted ? "標記為未完成" : "標記為完成"}
        style={{
          width: "1.25rem",
          height: "1.25rem",
          borderRadius: "50%",
          border: `2px solid ${todo.isCompleted ? groupColor : THEME.surfaceBorder}`,
          background: todo.isCompleted ? groupColor : "transparent",
          cursor: "pointer",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "0.15rem",
          color: "#FFF",
          fontSize: "0.65rem",
          transition: "background 0.15s, border-color 0.15s",
          padding: 0,
        }}
      >
        {todo.isCompleted && "✓"}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        {editingText ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") {
                setEditText(todo.item);
                setEditingText(false);
              }
            }}
            autoFocus
            style={{
              fontWeight: 700,
              fontSize: "0.9rem",
              color: THEME.text,
              border: `1px solid ${THEME.accent}`,
              borderRadius: "6px",
              padding: "0.15rem 0.35rem",
              width: "100%",
              marginBottom: "0.25rem",
              outline: "none",
            }}
          />
        ) : (
          <div
            onClick={() => {
              if (!todo.isCompleted && cardEditing) {
                setEditText(todo.item);
                setEditingText(true);
              }
            }}
            style={{
              fontWeight: 700,
              fontSize: "0.9rem",
              color: todo.isCompleted ? THEME.textMuted : THEME.text,
              textDecoration: todo.isCompleted ? "line-through" : "none",
              marginBottom: "0.25rem",
              cursor: !todo.isCompleted && cardEditing ? "pointer" : "default",
            }}
          >
            {todo.item}
          </div>
        )}

        {cardEditing ? (
          <>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={todoMetaStyle}>
                <input
                  type="date"
                  value={dueDateDisplay}
                  onChange={(e) => onUpdateDue(e.target.value)}
                  style={todoDateInputStyle}
                  aria-label="截止日期"
                />
              </span>

              <span style={todoMetaStyle}>
                <select
                  value=""
                  onChange={(e) => {
                    const uid = Number(e.target.value);
                    if (uid && !currentIds.includes(uid)) {
                      onUpdateAssignees([...currentIds, uid]);
                    }
                  }}
                  style={todoSelectStyle}
                  aria-label="指派成員"
                >
                  <option value="">
                    {currentIds.length === 0 ? "指派成員" : "+ 成員"}
                  </option>
                  {members
                    .filter((m) => !currentIds.includes(m.userId))
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName}
                      </option>
                    ))}
                </select>
              </span>
            </div>

            {todo.assignedUsers.length > 0 && (
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                {todo.assignedUsers.map((u) => (
                  <span key={u.userId} style={assigneeChipStyle}>
                    {u.displayName}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateAssignees(currentIds.filter((id) => id !== u.userId))
                      }
                      style={assigneeChipRemoveStyle}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                marginTop: "0.3rem",
              }}
            >
              <span style={{ ...groupPillDotStyle, background: groupColor }} />
              <select
                value={todo.lineGroupId}
                onChange={(e) => onUpdateGroup(e.target.value)}
                style={{
                  fontSize: "0.72rem",
                  color: THEME.textMuted,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="所屬群組"
              >
                {groups.map((g) => (
                  <option key={g.lineGroupId} value={g.lineGroupId}>
                    {g.name?.trim() || "未命名群組"}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.1rem" }}>
              {dueDateDisplay && (
                <span style={{ fontSize: "0.76rem", color: THEME.textMuted, display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {dueDateDisplay}
                </span>
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ ...groupPillDotStyle, background: groupColor }} />
                <span style={{ fontSize: "0.72rem", color: THEME.textMuted }}>{groupName}</span>
              </span>
            </div>

            {todo.assignedUsers.length > 0 && (
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                {todo.assignedUsers.map((u) => (
                  <span key={u.userId} style={{ ...assigneeChipStyle, cursor: "default" }}>
                    {u.displayName}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.15rem", flexShrink: 0, marginTop: "0.1rem" }}>
        {!todo.isCompleted && (
          <button
            type="button"
            onClick={() => setCardEditing((v) => !v)}
            aria-label={cardEditing ? "完成編輯" : "編輯待辦事項"}
            style={{
              border: "none",
              background: cardEditing ? `rgba(${THEME.accentRgb}, 0.12)` : "transparent",
              color: cardEditing ? THEME.accent : THEME.textMuted,
              cursor: "pointer",
              fontSize: "1.15rem",
              padding: "0.35rem 0.45rem",
              borderRadius: "8px",
              lineHeight: 1,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            ✎
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="刪除待辦事項"
          style={todoDeleteBtnStyle}
        >
          ✕
        </button>
      </div>
    </article>
  );
}
