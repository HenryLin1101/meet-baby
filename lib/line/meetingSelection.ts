import { listRecentGroupEvents } from "@/lib/db/repository";
import type { QuickReplyOption } from "@/lib/modules/types";

export type MeetingOption = {
  eventId: number;
  title: string;
  startsAt: string;
};

export type MeetingSelectionResult =
  | { matched: false }
  | { matched: true; eventId: number | null };

const SKIP_TEXT = "不指定";
const MAX_MEETINGS = 5;

export async function buildMeetingSelectionReplies(lineGroupId: string): Promise<{
  options: MeetingOption[];
  quickReplies: QuickReplyOption[];
}> {
  const recent = await listRecentGroupEvents(lineGroupId, 7);
  const options = recent.slice(0, MAX_MEETINGS);
  return { options, quickReplies: buildQuickRepliesFromOptions(options) };
}

export function buildQuickRepliesFromOptions(
  options: MeetingOption[]
): QuickReplyOption[] {
  const replies: QuickReplyOption[] = options.map((e, i) => ({
    label: truncateLabel(`${formatDate(e.startsAt)} ${e.title}`),
    text: String(i + 1),
  }));
  replies.push({ label: SKIP_TEXT, text: SKIP_TEXT });
  return replies;
}

export function parseMeetingSelection(
  text: string,
  options: MeetingOption[]
): MeetingSelectionResult {
  const trimmed = text.trim();
  if (trimmed === SKIP_TEXT) return { matched: true, eventId: null };
  const index = parseInt(trimmed, 10) - 1;
  if (!Number.isFinite(index) || index < 0 || index >= options.length) {
    return { matched: false };
  }
  return { matched: true, eventId: options[index].eventId };
}

function truncateLabel(label: string): string {
  return label.length > 20 ? `${label.slice(0, 19)}…` : label;
}

function formatDate(startsAt: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(startsAt));
}
