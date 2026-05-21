"use client";

import liff from "@line/liff";
import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { initLiffOrThrow } from "@/lib/liff/client";
import { LIFF_ID, MISSING_LIFF_ENV_MSG } from "@/lib/liff/utils";
import MascotLoadingScreen from "@/lib/liff/MascotLoadingScreen";
import MemberMultiSelect from "@/lib/tools/MemberMultiSelect";
import styles from "./page.module.css";

type Status =
  | "loading"
  | "checkingCalendar"
  | "calendarDisconnected"
  | "loadingMembers"
  | "ready"
  | "submitting"
  | "done"
  | "error";

type MeetingType = "inPerson" | "online" | "hybrid";

type GroupMember = {
  userId: number;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
};

const REMINDER_PRESETS: { label: string; value: number }[] = [
  { label: "5 分鐘", value: 5 },
  { label: "10 分鐘", value: 10 },
  { label: "30 分鐘", value: 30 },
  { label: "1 小時", value: 60 },
  { label: "2 小時", value: 120 },
  { label: "1 天", value: 1440 },
];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export default function MeetingLiffPage() {
  const [status, setStatus] = useState<Status>(LIFF_ID ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>(
    LIFF_ID ? "" : MISSING_LIFF_ENV_MSG
  );

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [groupId, setGroupId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [consentPageUrl, setConsentPageUrl] = useState("");
  const [createdMeetingUrl, setCreatedMeetingUrl] = useState<string | null>(null);
  const [meetingType, setMeetingType] = useState<MeetingType>("online");
  const [hasCalendarScope, setHasCalendarScope] = useState(false);
  const [consentModalVisible, setConsentModalVisible] = useState(false);

  // Reminder lead time
  const [reminderLeadTimeMinutes, setReminderLeadTimeMinutes] = useState(5);
  const [customReminderInput, setCustomReminderInput] = useState("");
  const [isCustomReminder, setIsCustomReminder] = useState(false);

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState("");

  // Advanced Settings Toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pre-seed weekday from the chosen date
  useEffect(() => {
    if (isRecurring && date) {
      const weekday = new Date(`${date}T00:00:00`).getDay();
      setRecurringWeekdays((prev) => (prev.length === 0 ? [weekday] : prev));
    }
  }, [isRecurring, date]);

  async function loadGroupMembers(
    nextGroupId: string,
    nextAccessToken: string,
    currentLineUserId: string | null
  ): Promise<void> {
    setStatus("loadingMembers");

    const response = await fetch(
      `/api/group-members?groupId=${encodeURIComponent(nextGroupId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${nextAccessToken}` },
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

    setMembers(nextMembers);
    setSelectedAttendeeIds(defaultSelected);
    setStatus("ready");
  }

  async function handleSkipCalendarConsent() {
    try {
      const currentLineUserId =
        liff.getDecodedIDToken()?.sub?.trim() ?? null;
      await loadGroupMembers(groupId, accessToken, currentLineUserId);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "讀取群組成員失敗");
    }
  }

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
        setStatus("checkingCalendar");

        const scopeResponse = await fetch(
          `/api/google/calendar-scope?groupId=${encodeURIComponent(nextGroupId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${nextAccessToken}` },
            cache: "no-store",
          }
        );
        const scopePayload = (await scopeResponse.json()) as {
          hasCalendarScope?: boolean;
          consentPageUrl?: string;
        };
        if (cancelled) return;

        setHasCalendarScope(Boolean(scopePayload.hasCalendarScope));
        setConsentPageUrl(scopePayload.consentPageUrl ?? "");

        if (!scopePayload.hasCalendarScope) {
          setStatus("calendarDisconnected");
          return;
        }

        if (cancelled) return;
        await loadGroupMembers(nextGroupId, nextAccessToken, currentLineUserId);
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
    if (isRecurring) {
      if (recurringWeekdays.length === 0) {
        window.alert("請至少選擇一個重複星期。");
        return;
      }
      if (!recurringEndDate) {
        window.alert("請選擇重複結束日期。");
        return;
      }
    }

    const wantsMeetingLink = meetingType !== "inPerson";
    if (wantsMeetingLink && !hasCalendarScope) {
      setConsentModalVisible(true);
      return;
    }

    await submitEvent(wantsMeetingLink);
  }

  async function submitEvent(wantsMeetingLink: boolean) {
    setConsentModalVisible(false);
    setStatus("submitting");

    try {
      const body: Record<string, unknown> = {
        groupId,
        title,
        date,
        time,
        location,
        note,
        attendeeUserIds: selectedAttendeeIds.map(Number),
        wantsMeetingLink,
        reminderLeadTimeMinutes,
      };

      if (isRecurring) {
        body.recurrence = {
          weekdays: recurringWeekdays,
          endDate: recurringEndDate,
        };
      }

      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        error?: string;
        meetingUrl?: string | null;
        notificationSent?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "建立活動失敗");
      }

      setCreatedMeetingUrl(payload.meetingUrl ?? null);
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

  function handleReminderPreset(value: number) {
    setReminderLeadTimeMinutes(value);
    setCustomReminderInput("");
    setIsCustomReminder(false);
  }

  function handleCustomReminderChange(raw: string) {
    setCustomReminderInput(raw);
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setReminderLeadTimeMinutes(parsed);
    }
  }

  function toggleWeekday(day: number) {
    setRecurringWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  const disabled = status !== "ready";

  const showBlockingLoader =
    Boolean(LIFF_ID) &&
    (status === "loading" ||
      status === "checkingCalendar" ||
      status === "loadingMembers");

  if (status === "calendarDisconnected") {
    return (
      <main className={`${styles.main} ${styles.consentScreen}`}>
        <div className={`${styles.pageInner} ${styles.consentInner}`}>
          <h1 className={`${styles.pageTitle} ${styles.consentTitle}`}>
            連結 Google 日曆
          </h1>
          <p className={`${styles.pageSubtitle} ${styles.consentBody}`}>
            米特寶寶需要 Google 日曆權限才能產生 Meet 連結。
            請點下方按鈕在外部瀏覽器完成授權（LINE 內建瀏覽器會被 Google 擋）。
          </p>
          {consentPageUrl ? (
            <a
              href={consentPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.calendarConnectButton}
            >
              連結 Google 日曆
            </a>
          ) : (
            <p className={styles.modalConsentFallback}>
              無法產生授權連結，請關閉後重新開啟。
            </p>
          )}
          <button
            type="button"
            onClick={handleSkipCalendarConsent}
            className={styles.calendarSkipButton}
          >
            稍後再說（不產生 Meet 連結）
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {showBlockingLoader && <MascotLoadingScreen />}
      {!showBlockingLoader && (
        <main className={styles.main}>
          <div className={styles.pageInner}>
            <h1 className={styles.pageTitle}>預約會議</h1>
            <p className={styles.pageSubtitle}>
              填寫資料送出後，會建立活動並通知群組。
            </p>

            {status === "error" && <div className={styles.errorBox}>{errorMsg}</div>}

            <div className={styles.formPanel}>
              <form onSubmit={handleSubmit} className={styles.form}>
                <Field label="會議主題" required>
                  <input
                    className={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：專案同步會議"
                    required
                    disabled={disabled}
                    autoComplete="off"
                  />
                </Field>

                <div className={styles.dateTimeRowWrap}>
                  <div className={styles.rowAlways}>
                    <Field label="日期" required>
                      <input
                        className={styles.dateTimeInput}
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        disabled={disabled}
                      />
                    </Field>
                    <Field label="時間" required>
                      <input
                        className={styles.dateTimeInput}
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        required
                        disabled={disabled}
                      />
                    </Field>
                  </div>
                </div>

                {/* Recurring meeting toggle */}
                <label className={styles.toggleRow}>
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    disabled={disabled}
                    className={styles.toggleCheckbox}
                  />
                  <span className={styles.toggleLabel}>重複會議</span>
                </label>

                {isRecurring && (
                  <div className={styles.recurrencePanel}>
                    <span className={styles.label}>重複星期</span>
                    <div className={styles.weekdayRow}>
                      {WEEKDAY_LABELS.map((label, day) => {
                        const active = recurringWeekdays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleWeekday(day)}
                            disabled={disabled}
                            className={`${styles.weekdayButton} ${active ? styles.weekdayButtonActive : ""}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <Field label="重複結束日期" required>
                      <input
                        className={styles.dateTimeInput}
                        type="date"
                        value={recurringEndDate}
                        min={date || undefined}
                        onChange={(e) => setRecurringEndDate(e.target.value)}
                        required={isRecurring}
                        disabled={disabled}
                      />
                    </Field>
                  </div>
                )}

                <Field label="會議形式" required>
                  <div className={styles.meetingTypeGroup} role="radiogroup">
                    {(
                      [
                        { value: "inPerson", label: "實體" },
                        { value: "online", label: "線上" },
                        { value: "hybrid", label: "混合" },
                      ] as Array<{ value: MeetingType; emoji: string; label: string }>
                    ).map((opt) => {
                      const active = meetingType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setMeetingType(opt.value)}
                          disabled={disabled}
                          className={`${styles.meetingTypeOption} ${active ? styles.meetingTypeOptionActive : ""}`}
                        >
                          <span className={styles.meetingTypeOptionEmoji}>{opt.emoji}</span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {meetingType !== "inPerson" && (
                    <p className={styles.meetingTypeHint}>
                      系統會自動產生 Google Meet 連結並一併通知群組。
                    </p>
                  )}
                </Field>

                {meetingType !== "online" && (
                  <Field label="地點">
                    <input
                      className={styles.input}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="例如：會議室 A"
                      disabled={disabled}
                    />
                  </Field>
                )}

                <Field label="參與者" required>
                  <MemberMultiSelect
                    members={members}
                    selectedIds={selectedAttendeeIds}
                    onChange={setSelectedAttendeeIds}
                    disabled={disabled || members.length === 0}
                  />
                </Field>

                <button
                  type="button"
                  className={styles.advancedToggle}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  disabled={disabled}
                >
                  {showAdvanced ? "收合進階設定" : "+ 展開進階設定 (備註、提醒時間)"}
                </button>

                {showAdvanced && (
                  <div className={styles.advancedPanel}>
                    <Field label="備註">
                      <input
                        className={styles.input}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="選填"
                        disabled={disabled}
                      />
                    </Field>

                    {/* Reminder lead time */}
                    <div className={styles.field}>
                      <span className={styles.label}>提醒時間</span>
                      <div className={styles.reminderRow}>
                        <select
                          className={styles.reminderSelect}
                          value={isCustomReminder ? "custom" : String(reminderLeadTimeMinutes)}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setIsCustomReminder(true);
                              setCustomReminderInput("");
                            } else {
                              handleReminderPreset(Number(e.target.value));
                            }
                          }}
                          disabled={disabled}
                        >
                          {REMINDER_PRESETS.map((p) => (
                            <option key={p.value} value={String(p.value)}>{p.label}前</option>
                          ))}
                          <option value="custom">自訂…</option>
                        </select>
                        {isCustomReminder && (
                          <>
                            <input
                              type="number"
                              min={1}
                              max={10080}
                              inputMode="numeric"
                              className={styles.reminderCustomInput}
                              value={customReminderInput}
                              onChange={(e) => handleCustomReminderChange(e.target.value)}
                              placeholder="分鐘"
                              disabled={disabled}
                              // eslint-disable-next-line jsx-a11y/no-autofocus
                              autoFocus
                            />
                            <span className={styles.reminderCustomUnit}>分鐘前</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={disabled}
                >
                  {status === "submitting"
                    ? "送出中…"
                    : status === "done"
                      ? "已送出"
                      : status === "loading" ||
                          status === "checkingCalendar" ||
                          status === "loadingMembers"
                        ? "載入中…"
                        : "送出預約"}
                </button>

                {status === "done" && createdMeetingUrl && (
                  <div className={styles.meetingUrlBox}>
                    <span className={styles.meetingUrlBoxLabel}>
                      Google Meet 連結
                    </span>
                    <a
                      href={createdMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.meetingUrlBoxLink}
                    >
                      {createdMeetingUrl}
                    </a>
                  </div>
                )}
              </form>
            </div>
          </div>
        </main>
      )}
      {consentModalVisible && (
        <div
          role="dialog"
          aria-modal="true"
          className={styles.modalOverlay}
          onClick={() => setConsentModalVisible(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>連結 Google 日曆</h2>
            <p className={styles.modalBody}>
              需要 Google 日曆權限才能產生 Meet 連結。
              請在外部瀏覽器完成授權（LINE 內建瀏覽器會被 Google 擋）。
            </p>
            <div className={styles.modalActions}>
              {consentPageUrl ? (
                <a
                  href={consentPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.calendarConnectButton}
                >
                  連結 Google 日曆
                </a>
              ) : (
                <p className={styles.modalConsentFallback}>
                  無法產生授權連結，請關閉後重新開啟。
                </p>
              )}
              <button
                type="button"
                onClick={() => submitEvent(false)}
                className={styles.calendarSkipButton}
              >
                不要 Meet 連結，直接送出
              </button>
              <button
                type="button"
                onClick={() => setConsentModalVisible(false)}
                className={styles.modalCancelButton}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
    <label className={styles.field}>
      <span className={styles.label}>
        {label}
        {required && <span className={styles.required}> *</span>}
      </span>
      {children}
    </label>
  );
}