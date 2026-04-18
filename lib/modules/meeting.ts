/**
 * 會議相關邏輯。目前以記憶體陣列暫存，之後可換成資料庫。
 */

export type MeetingDraft = {
  title: string;
  time: string;
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
