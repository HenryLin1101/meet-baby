/**
 * 會議相關共用邏輯。
 * 目前文字模式仍保留記憶體暫存，LIFF / API 流程則以資料庫為主。
 */

export type MeetingDraft = {
  title: string;
  time: string;
};

export type MeetingSummaryInput = {
  title: string;
  timeLabel: string;
  location?: string | null;
  note?: string | null;
  attendeeNames?: string[];
};

const meetings: MeetingDraft[] = [];

/** 粗略解析時間格式：YYYY-MM-DD HH:mm。格式不合回傳 null。 */
export function parseMeetingTime(input: string): string | null {
  const trimmed = input.trim();
  const ok = /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/.test(trimmed);
  return ok ? trimmed : null;
}

export function createMeeting(draft: MeetingDraft): MeetingDraft {
  meetings.push(draft);
  return draft;
}

export function listMeetings(): readonly MeetingDraft[] {
  return meetings;
}

export function buildMeetingSummary(input: MeetingSummaryInput): string {
  const lines = [
    "【會議預約】",
    `主題：${input.title}`,
    `時間：${input.timeLabel}`,
  ];

  const location = input.location?.trim();
  if (location) lines.push(`地點：${location}`);

  if (input.attendeeNames && input.attendeeNames.length > 0) {
    lines.push(`參與者：${input.attendeeNames.join("、")}`);
  }

  const note = input.note?.trim();
  if (note) lines.push(`備註：${note}`);

  return lines.join("\n");
}

export function formatMeetingDateTime(
  value: string | Date,
  timeZone = "Asia/Taipei"
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replaceAll("/", "-");
}
