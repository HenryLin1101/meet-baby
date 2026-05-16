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

        // Check if the meeting creator has Google Calendar scope.
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
          wantsMeetingLink,
        }),
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

  const disabled = status !== "ready";

  const showBlockingLoader =
    Boolean(LIFF_ID) &&
    (status === "loading" ||
      status === "checkingCalendar" ||
      status === "loadingMembers");

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

            {/* 日期/時間直向堆疊；外層限制寬度避免原生 date/time 撐破白卡 */}
            <div className={styles.dateTimeRowWrap}>
              <Row>
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
              </Row>
            </div>

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

            <Field label="備註">
              <textarea
                className={styles.input}
                style={{ minHeight: "5.5rem", resize: "vertical" }}
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
              />
            </Field>

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

function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
