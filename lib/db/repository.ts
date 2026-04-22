import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/db/client";

type ChatGroupRow = {
  id: number;
  line_group_id: string;
  name: string | null;
  picture_url: string | null;
};

type LineUserRow = {
  id: number;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
  status_message: string | null;
  language_code: string | null;
  email: string | null;
};

export type LineUserProfileInput = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
  statusMessage?: string | null;
  languageCode?: string | null;
  email?: string | null;
};

export type GroupMember = {
  userId: number;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
};

export type LineUserReference = {
  userId: number;
  lineUserId: string;
  displayName: string;
};

type GroupMemberRow = {
  id: number;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
};

type GroupMembershipRow = {
  id: number;
  group_id: number;
  user_id: number;
  is_active: boolean;
  left_at: string | null;
};

type CreatedEventRow = {
  event_id: number;
  line_group_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  attendee_display_names: string[];
};

type ListedEventRow = {
  id: number;
  created_by_user_id: number;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  status: string;
};

type ListedEventOwnerRow = {
  id: number;
  display_name: string;
};

type UpcomingEventRow = {
  event_id: number;
  line_group_id: string;
  title: string;
  location: string | null;
  starts_at: string;
  timezone: string;
};

type EventReminderEventRow = {
  id: number;
  group_id: number;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  timezone: string;
  status: string;
  reminder_message_id: string | null;
  reminder_scheduled_at: string | null;
  reminder_processing_at: string | null;
  reminder_sent_at: string | null;
  reminder_last_error: string | null;
};

type EventReminderAttendeeRow = {
  user_id: number;
};

export type CreateEventWithAttendeesInput = {
  lineGroupId: string;
  createdByLineUserId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  timezone?: string;
  attendeeUserIds: number[];
};

export type CreatedEvent = {
  eventId: number;
  lineGroupId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  attendeeDisplayNames: string[];
};

export type ListedEvent = {
  eventId: number;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
  ownerDisplayName: string;
};

export type UpcomingEvent = {
  eventId: number;
  lineGroupId: string;
  title: string;
  location: string | null;
  startsAt: string;
  timezone: string;
};

export type EventReminderDetails = {
  eventId: number;
  lineGroupId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  timezone: string;
  status: string;
  reminderMessageId: string | null;
  reminderScheduledAt: string | null;
  reminderSentAt: string | null;
  attendees: LineUserReference[];
};

export type EventReminderScheduleInput = {
  eventId: number;
  messageId: string;
  scheduledAt: string;
};

export type GoogleCredential = {
  userId: number;
  refreshToken: string;
  scopes: string | null;
  revokedAt: string | null;
};

export type CreateGoogleOAuthStateInput = {
  lineUserId: string;
  state: string;
  expiresAt: string;
};

export type CreatedSummary = {
  summaryId: number;
};

export type SummaryProcessingDetails = {
  summaryId: number;
  lineGroupId: string;
  requestedByLineUserId: string;
  sourceDriveUrl: string;
  sourceDriveFileId: string;
};

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RepositoryError(`${label} 不可為空。`, 400, "INVALID_INPUT");
  }
  return trimmed;
}

function normalizeOptionalText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseEventDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RepositoryError(`${label} 格式不正確。`, 400, "INVALID_INPUT");
  }
  return date;
}

function requireFiniteNumber(value: number, label: string): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    throw new RepositoryError(`${label} 格式不正確。`, 400, "INVALID_INPUT");
  }
  return normalized;
}

function parseRepositoryErrorMessage(message: string): RepositoryError | null {
  const separators = [": ", ":"];
  for (const separator of separators) {
    const [rawCode, rawMessage] = message.split(separator, 2);
    if (!rawCode || !rawMessage) continue;

    switch (rawCode) {
      case "GROUP_NOT_FOUND":
        return new RepositoryError(rawMessage, 404, rawCode);
      case "USER_NOT_FOUND":
        return new RepositoryError(rawMessage, 404, rawCode);
      case "FORBIDDEN":
        return new RepositoryError(rawMessage, 403, rawCode);
      case "INVALID_ATTENDEES":
      case "INVALID_INPUT":
        return new RepositoryError(rawMessage, 400, rawCode);
      default:
        break;
    }
  }

  return null;
}

function assertNoError(
  error: PostgrestError | null,
  fallbackMessage: string
): void {
  if (!error) return;

  const parsed = parseRepositoryErrorMessage(error.message);
  if (parsed) throw parsed;

  throw new RepositoryError(fallbackMessage, 500, error.code || "DB_ERROR");
}

function toCreatedEvent(row: CreatedEventRow): CreatedEvent {
  return {
    eventId: Number(row.event_id),
    lineGroupId: String(row.line_group_id),
    title: String(row.title),
    description: row.description === null ? null : String(row.description),
    location: row.location === null ? null : String(row.location),
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: row.ends_at === null ? null : new Date(row.ends_at).toISOString(),
    timezone: String(row.timezone),
    attendeeDisplayNames: Array.isArray(row.attendee_display_names)
      ? row.attendee_display_names.map(String)
      : [],
  };
}

async function getChatGroupByLineGroupId(
  lineGroupId: string
): Promise<ChatGroupRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_groups")
    .select("id, line_group_id, name, picture_url")
    .eq("line_group_id", lineGroupId)
    .maybeSingle<ChatGroupRow>();

  assertNoError(error, "讀取群組資料失敗。");
  return data;
}

async function getLineUserByLineUserId(
  lineUserId: string
): Promise<LineUserRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("line_users")
    .select(
      "id, line_user_id, display_name, picture_url, status_message, language_code, email"
    )
    .eq("line_user_id", lineUserId)
    .maybeSingle<LineUserRow>();

  assertNoError(error, "讀取 LINE 使用者資料失敗。");
  return data;
}

async function getActiveMembership(
  groupId: number,
  userId: number
): Promise<GroupMembershipRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("group_memberships")
    .select("id, group_id, user_id, is_active, left_at")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle<GroupMembershipRow>();

  assertNoError(error, "讀取群組成員資料失敗。");
  return data;
}

type GoogleCredentialRow = {
  user_id: number;
  refresh_token: string;
  scopes: string | null;
  revoked_at: string | null;
};

type GoogleOAuthStateRow = {
  state: string;
  user_id: number;
  expires_at: string;
  used_at: string | null;
};

type EventSummaryRow = {
  id: number;
  group_id: number;
  requested_by_user_id: number;
  source_drive_url: string;
  source_drive_file_id: string;
  status: string;
  processing_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  qstash_message_id: string | null;
};

export async function ensureChatGroup(
  lineGroupId: string,
  name?: string | null,
  pictureUrl?: string | null
): Promise<ChatGroupRow> {
  const supabase = getSupabaseAdmin();
  const trimmedLineGroupId = requireNonEmpty(lineGroupId, "groupId");
  const trimmedName = normalizeOptionalText(name);
  const normalizedPictureUrl = normalizeOptionalText(pictureUrl);

  const insertPayload: {
    line_group_id: string;
    name?: string | null;
    picture_url?: string | null;
  } = {
    line_group_id: trimmedLineGroupId,
  };
  if (trimmedName) insertPayload.name = trimmedName;
  if (normalizedPictureUrl) insertPayload.picture_url = normalizedPictureUrl;

  const { data, error } = await supabase
    .from("chat_groups")
    .upsert(insertPayload, { onConflict: "line_group_id" })
    .select("id, line_group_id, name, picture_url")
    .single<ChatGroupRow>();

  assertNoError(error, "建立或更新群組資料失敗。");

  if (!data) {
    throw new RepositoryError("群組資料不存在。", 500, "DB_ERROR");
  }

  return data;
}

export async function upsertLineUser(
  input: LineUserProfileInput
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const lineUserId = requireNonEmpty(input.lineUserId, "lineUserId");
  const displayName = requireNonEmpty(input.displayName, "displayName");
  const existing = await getLineUserByLineUserId(lineUserId);

  if (existing) {
    const { error } = await supabase
      .from("line_users")
      .update({
        display_name: displayName,
        picture_url:
          normalizeOptionalText(input.pictureUrl) ?? existing.picture_url,
        status_message:
          normalizeOptionalText(input.statusMessage) ?? existing.status_message,
        language_code:
          normalizeOptionalText(input.languageCode) ?? existing.language_code,
        email: normalizeOptionalText(input.email) ?? existing.email,
      })
      .eq("id", existing.id);

    assertNoError(error, "更新 LINE 使用者資料失敗。");
    return;
  }

  const { error } = await supabase.from("line_users").insert({
    line_user_id: lineUserId,
    display_name: displayName,
    picture_url: normalizeOptionalText(input.pictureUrl),
    status_message: normalizeOptionalText(input.statusMessage),
    language_code: normalizeOptionalText(input.languageCode),
    email: normalizeOptionalText(input.email),
  });

  assertNoError(error, "建立 LINE 使用者資料失敗。");
}

export async function upsertGroupMembership(
  lineGroupId: string,
  lineUserId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const group = await ensureChatGroup(lineGroupId);

  const user = await getLineUserByLineUserId(lineUserId);
  if (!user) {
    throw new RepositoryError(
      "找不到對應的 LINE 使用者資料。",
      404,
      "USER_NOT_FOUND"
    );
  }

  const membership = await getActiveMembership(group.id, user.id);
  if (membership) return;

  const { error } = await supabase.from("group_memberships").upsert(
    {
      group_id: group.id,
      user_id: user.id,
      joined_at: new Date().toISOString(),
      left_at: null,
      is_active: true,
    },
    {
      onConflict: "group_id,user_id",
    }
  );

  assertNoError(error, "建立群組成員資料失敗。");
}

export async function listActiveGroupMembers(
  lineGroupId: string
): Promise<GroupMember[]> {
  const supabase = getSupabaseAdmin();
  const group = await getChatGroupByLineGroupId(lineGroupId);
  if (!group) {
    throw new RepositoryError("群組資料不存在。", 404, "GROUP_NOT_FOUND");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("group_memberships")
    .select("user_id")
    .eq("group_id", group.id)
    .eq("is_active", true);

  assertNoError(membershipError, "讀取群組成員資料失敗。");

  const userIds = (memberships ?? [])
    .map((row) => Number(row.user_id))
    .filter(Number.isFinite);

  if (userIds.length === 0) {
    return [];
  }

  const { data: users, error: userError } = await supabase
    .from("line_users")
    .select("id, line_user_id, display_name, picture_url")
    .in("id", userIds)
    .order("display_name", { ascending: true })
    .order("id", { ascending: true });

  assertNoError(userError, "讀取 LINE 使用者清單失敗。");

  return (users ?? []).map((row) => {
    const user = row as GroupMemberRow;
    return {
      userId: Number(user.id),
      lineUserId: String(user.line_user_id),
      displayName: String(user.display_name),
      pictureUrl: user.picture_url === null ? null : String(user.picture_url),
    };
  });
}

export async function listLineUsersByIds(
  userIds: number[]
): Promise<LineUserReference[]> {
  const supabase = getSupabaseAdmin();
  const normalizedUserIds = [...new Set(userIds.map(Number))].filter(Number.isFinite);

  if (normalizedUserIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("line_users")
    .select("id, line_user_id, display_name")
    .in("id", normalizedUserIds)
    .order("display_name", { ascending: true })
    .order("id", { ascending: true });

  assertNoError(error, "讀取 LINE 使用者資料失敗。");

  return (data ?? []).map((row) => ({
    userId: Number(row.id),
    lineUserId: String(row.line_user_id),
    displayName: String(row.display_name),
  }));
}

function toUpcomingEvent(
  row: UpcomingEventRow,
): UpcomingEvent {
  return {
    eventId: Number(row.event_id),
    lineGroupId: String(row.line_group_id),
    title: String(row.title),
    location: row.location === null ? null : String(row.location),
    startsAt: new Date(row.starts_at).toISOString(),
    timezone: String(row.timezone),
  };
}

export async function isEventAttendee(
  eventId: number,
  lineUserId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = Number(eventId);
  if (!Number.isFinite(normalizedEventId)) {
    throw new RepositoryError("eventId 格式不正確。", 400, "INVALID_INPUT");
  }
  const normalizedLineUserId = requireNonEmpty(lineUserId, "lineUserId");

  const { data, error } = await supabase.rpc("is_event_attendee", {
    p_event_id: normalizedEventId,
    p_line_user_id: normalizedLineUserId,
  });
  assertNoError(error, "判斷活動參與者失敗。");

  return Boolean(data);
}

export async function getGroupNextEvent(
  lineGroupId: string
): Promise<UpcomingEvent | null> {
  const supabase = getSupabaseAdmin();
  const normalizedLineGroupId = requireNonEmpty(lineGroupId, "lineGroupId");

  const { data, error } = await supabase
    .rpc("get_group_next_event", {
      p_line_group_id: normalizedLineGroupId,
    })
    .maybeSingle<UpcomingEventRow>();
  assertNoError(error, "讀取群組下一場活動失敗。");

  if (!data) {
    return null;
  }

  return toUpcomingEvent(data);
}

export async function getUserNextEvent(
  lineUserId: string
): Promise<UpcomingEvent | null> {
  const supabase = getSupabaseAdmin();
  const normalizedLineUserId = requireNonEmpty(lineUserId, "lineUserId");

  const { data: event, error: eventError } = await supabase
    .rpc("get_user_next_event", {
      p_line_user_id: normalizedLineUserId,
    })
    .maybeSingle<UpcomingEventRow>();
  assertNoError(eventError, "讀取使用者下一場活動失敗。");

  if (!event) {
    return null;
  }

  return toUpcomingEvent(event);
}

export async function listGroupEvents(
  lineGroupId: string
): Promise<ListedEvent[]> {
  const supabase = getSupabaseAdmin();
  const group = await getChatGroupByLineGroupId(lineGroupId);
  if (!group) {
    throw new RepositoryError("群組資料不存在。", 404, "GROUP_NOT_FOUND");
  }

  const { data: events, error: eventError } = await supabase
    .from("events")
    .select(
      "id, created_by_user_id, title, description, location, starts_at, ends_at, timezone, status"
    )
    .eq("group_id", group.id)
    .eq("status", "scheduled")
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true });

  assertNoError(eventError, "讀取活動清單失敗。");

  const rows = (events ?? []) as ListedEventRow[];
  if (rows.length === 0) {
    return [];
  }

  const ownerIds = [...new Set(rows.map((row) => Number(row.created_by_user_id)))].filter(
    Number.isFinite
  );

  const { data: owners, error: ownerError } = await supabase
    .from("line_users")
    .select("id, display_name")
    .in("id", ownerIds);

  assertNoError(ownerError, "讀取活動建立者資料失敗。");

  const ownerMap = new Map<number, string>(
    ((owners ?? []) as ListedEventOwnerRow[]).map((owner) => [
      Number(owner.id),
      String(owner.display_name),
    ])
  );

  return rows.map((row) => ({
    eventId: Number(row.id),
    title: String(row.title),
    description: row.description === null ? null : String(row.description),
    location: row.location === null ? null : String(row.location),
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: row.ends_at === null ? null : new Date(row.ends_at).toISOString(),
    timezone: String(row.timezone),
    status: String(row.status),
    ownerDisplayName:
      ownerMap.get(Number(row.created_by_user_id)) ?? "未知建立者",
  }));
}

export async function setEventReminderSchedule(
  input: EventReminderScheduleInput
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const eventId = Number(input.eventId);
  if (!Number.isFinite(eventId)) {
    throw new RepositoryError("eventId 格式不正確。", 400, "INVALID_INPUT");
  }

  const messageId = requireNonEmpty(input.messageId, "messageId");
  const scheduledAt = parseEventDate(input.scheduledAt, "scheduledAt");

  const { error } = await supabase
    .from("events")
    .update({
      reminder_message_id: messageId,
      reminder_scheduled_at: scheduledAt.toISOString(),
      reminder_last_error: null,
    })
    .eq("id", eventId);

  assertNoError(error, "儲存提醒排程失敗。");
}

export async function claimEventReminder(eventId: number): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = Number(eventId);
  if (!Number.isFinite(normalizedEventId)) {
    throw new RepositoryError("eventId 格式不正確。", 400, "INVALID_INPUT");
  }

  const { data, error } = await supabase
    .from("events")
    .update({
      reminder_processing_at: new Date().toISOString(),
      reminder_last_error: null,
    })
    .eq("id", normalizedEventId)
    .eq("status", "scheduled")
    .is("reminder_sent_at", null)
    .is("reminder_processing_at", null)
    .select("id")
    .maybeSingle<{ id: number }>();

  assertNoError(error, "鎖定提醒任務失敗。");
  return Boolean(data);
}

export async function releaseEventReminderFailure(
  eventId: number,
  message: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = Number(eventId);
  if (!Number.isFinite(normalizedEventId)) {
    throw new RepositoryError("eventId 格式不正確。", 400, "INVALID_INPUT");
  }

  const { error } = await supabase
    .from("events")
    .update({
      reminder_processing_at: null,
      reminder_last_error: normalizeOptionalText(message),
    })
    .eq("id", normalizedEventId);

  assertNoError(error, "更新提醒失敗狀態失敗。");
}

export async function markEventReminderSent(eventId: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = Number(eventId);
  if (!Number.isFinite(normalizedEventId)) {
    throw new RepositoryError("eventId 格式不正確。", 400, "INVALID_INPUT");
  }

  const { error } = await supabase
    .from("events")
    .update({
      reminder_processing_at: null,
      reminder_sent_at: new Date().toISOString(),
      reminder_last_error: null,
    })
    .eq("id", normalizedEventId);

  assertNoError(error, "標記提醒已送出失敗。");
}

export async function getEventReminderDetails(
  eventId: number
): Promise<EventReminderDetails | null> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = Number(eventId);
  if (!Number.isFinite(normalizedEventId)) {
    throw new RepositoryError("eventId 格式不正確。", 400, "INVALID_INPUT");
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "id, group_id, title, description, location, starts_at, timezone, status, reminder_message_id, reminder_scheduled_at, reminder_processing_at, reminder_sent_at, reminder_last_error"
    )
    .eq("id", normalizedEventId)
    .maybeSingle<EventReminderEventRow>();

  assertNoError(eventError, "讀取提醒活動失敗。");

  if (!event) {
    return null;
  }

  const { data: group, error: groupError } = await supabase
    .from("chat_groups")
    .select("id, line_group_id, name, picture_url")
    .eq("id", Number(event.group_id))
    .maybeSingle<ChatGroupRow>();

  assertNoError(groupError, "讀取群組資料失敗。");
  if (!group) {
    throw new RepositoryError("群組資料不存在。", 404, "GROUP_NOT_FOUND");
  }

  const { data: attendeeRows, error: attendeeError } = await supabase
    .from("event_attendees")
    .select("user_id")
    .eq("event_id", normalizedEventId)
    .order("user_id", { ascending: true });

  assertNoError(attendeeError, "讀取活動參與者失敗。");

  const attendees = await listLineUsersByIds(
    ((attendeeRows ?? []) as EventReminderAttendeeRow[]).map((row) => Number(row.user_id))
  );

  return {
    eventId: Number(event.id),
    lineGroupId: String(group.line_group_id),
    title: String(event.title),
    description: event.description === null ? null : String(event.description),
    location: event.location === null ? null : String(event.location),
    startsAt: new Date(event.starts_at).toISOString(),
    timezone: String(event.timezone),
    status: String(event.status),
    reminderMessageId:
      event.reminder_message_id === null ? null : String(event.reminder_message_id),
    reminderScheduledAt:
      event.reminder_scheduled_at === null
        ? null
        : new Date(event.reminder_scheduled_at).toISOString(),
    reminderSentAt:
      event.reminder_sent_at === null ? null : new Date(event.reminder_sent_at).toISOString(),
    attendees,
  };
}

export async function createEventWithAttendees(
  input: CreateEventWithAttendeesInput
): Promise<CreatedEvent> {
  const lineGroupId = requireNonEmpty(input.lineGroupId, "groupId");
  const createdByLineUserId = requireNonEmpty(
    input.createdByLineUserId,
    "createdByLineUserId"
  );
  const title = requireNonEmpty(input.title, "title");
  const description = normalizeOptionalText(input.description);
  const location = normalizeOptionalText(input.location);
  const timezone = normalizeOptionalText(input.timezone) ?? "Asia/Taipei";
  const startsAt = parseEventDate(input.startsAt, "startsAt");
  const endsAt = input.endsAt ? parseEventDate(input.endsAt, "endsAt") : null;
  if (endsAt && endsAt <= startsAt) {
    throw new RepositoryError("結束時間必須晚於開始時間。", 400, "INVALID_INPUT");
  }

  const attendeeUserIds = [...new Set(input.attendeeUserIds.map(Number))].filter(
    Number.isFinite
  );
  if (attendeeUserIds.length === 0) {
    throw new RepositoryError("請至少選擇一位參與者。", 400, "INVALID_INPUT");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc("create_event_with_attendees", {
      p_line_group_id: lineGroupId,
      p_created_by_line_user_id: createdByLineUserId,
      p_title: title,
      p_description: description,
      p_location: location,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt?.toISOString() ?? null,
      p_timezone: timezone,
      p_attendee_user_ids: attendeeUserIds,
    })
    .single<CreatedEventRow>();

  assertNoError(error, "建立活動失敗。");

  if (!data) {
    throw new RepositoryError("建立活動失敗。", 500, "DB_ERROR");
  }

  return toCreatedEvent(data);
}

export async function createGoogleOAuthState(
  input: CreateGoogleOAuthStateInput
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const lineUserId = requireNonEmpty(input.lineUserId, "lineUserId");
  const state = requireNonEmpty(input.state, "state");
  const expiresAt = parseEventDate(input.expiresAt, "expiresAt");

  const user = await getLineUserByLineUserId(lineUserId);
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const { error } = await supabase.from("google_oauth_states").insert({
    state,
    user_id: user.id,
    expires_at: expiresAt.toISOString(),
  });
  assertNoError(error, "建立 Google OAuth state 失敗。");
}

export async function consumeGoogleOAuthState(
  state: string
): Promise<{ lineUserId: string } | null> {
  const supabase = getSupabaseAdmin();
  const normalizedState = requireNonEmpty(state, "state");

  const { data, error } = await supabase
    .from("google_oauth_states")
    .select("state, user_id, expires_at, used_at")
    .eq("state", normalizedState)
    .maybeSingle<GoogleOAuthStateRow>();
  assertNoError(error, "讀取 Google OAuth state 失敗。");

  if (!data) return null;
  if (data.used_at) return null;
  const expiresAt = new Date(data.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const { error: updateError } = await supabase
    .from("google_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("state", normalizedState)
    .is("used_at", null);
  assertNoError(updateError, "更新 Google OAuth state 失敗。");

  const { data: user, error: userError } = await supabase
    .from("line_users")
    .select("line_user_id")
    .eq("id", Number(data.user_id))
    .maybeSingle<{ line_user_id: string }>();
  assertNoError(userError, "讀取 LINE 使用者資料失敗。");
  if (!user) return null;

  return { lineUserId: String(user.line_user_id) };
}

export async function upsertGoogleCredentialForLineUser(
  input: {
    lineUserId: string;
    refreshToken: string;
    scopes?: string | null;
  }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const lineUserId = requireNonEmpty(input.lineUserId, "lineUserId");
  const refreshToken = requireNonEmpty(input.refreshToken, "refreshToken");
  const user = await getLineUserByLineUserId(lineUserId);
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const { error } = await supabase.from("google_credentials").upsert(
    {
      user_id: user.id,
      refresh_token: refreshToken,
      scopes: normalizeOptionalText(input.scopes),
      revoked_at: null,
    },
    { onConflict: "user_id" }
  );
  assertNoError(error, "儲存 Google 憑證失敗。");
}

export async function getGoogleCredentialByLineUserId(
  lineUserId: string
): Promise<GoogleCredential | null> {
  const supabase = getSupabaseAdmin();
  const normalizedLineUserId = requireNonEmpty(lineUserId, "lineUserId");
  const user = await getLineUserByLineUserId(normalizedLineUserId);
  if (!user) return null;

  const { data, error } = await supabase
    .from("google_credentials")
    .select("user_id, refresh_token, scopes, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle<GoogleCredentialRow>();
  assertNoError(error, "讀取 Google 憑證失敗。");

  if (!data) return null;

  return {
    userId: Number(data.user_id),
    refreshToken: String(data.refresh_token),
    scopes: data.scopes === null ? null : String(data.scopes),
    revokedAt: data.revoked_at === null ? null : String(data.revoked_at),
  };
}

export async function createEventSummary(
  input: {
    lineGroupId: string;
    requestedByLineUserId: string;
    sourceDriveUrl: string;
    sourceDriveFileId: string;
  }
): Promise<CreatedSummary> {
  const supabase = getSupabaseAdmin();
  const lineGroupId = requireNonEmpty(input.lineGroupId, "lineGroupId");
  const requestedByLineUserId = requireNonEmpty(
    input.requestedByLineUserId,
    "requestedByLineUserId"
  );
  const sourceDriveUrl = requireNonEmpty(input.sourceDriveUrl, "sourceDriveUrl");
  const sourceDriveFileId = requireNonEmpty(
    input.sourceDriveFileId,
    "sourceDriveFileId"
  );

  const group = await getChatGroupByLineGroupId(lineGroupId);
  if (!group) {
    throw new RepositoryError("群組資料不存在。", 404, "GROUP_NOT_FOUND");
  }
  const user = await getLineUserByLineUserId(requestedByLineUserId);
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const membership = await getActiveMembership(group.id, user.id);
  if (!membership) {
    throw new RepositoryError("你不是此群組的有效成員。", 403, "FORBIDDEN");
  }

  const { data, error } = await supabase
    .from("event_summaries")
    .insert({
      group_id: group.id,
      requested_by_user_id: user.id,
      source_drive_url: sourceDriveUrl,
      source_drive_file_id: sourceDriveFileId,
      status: "pending",
      processing_at: null,
      completed_at: null,
      last_error: null,
    })
    .select("id")
    .single<{ id: number }>();

  assertNoError(error, "建立會議總結任務失敗。");
  if (!data) {
    throw new RepositoryError("建立會議總結任務失敗。", 500, "DB_ERROR");
  }
  return { summaryId: Number(data.id) };
}

export async function setEventSummaryQStashMessageId(
  input: { summaryId: number; messageId: string }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const summaryId = requireFiniteNumber(input.summaryId, "summaryId");
  const messageId = requireNonEmpty(input.messageId, "messageId");

  const { error } = await supabase
    .from("event_summaries")
    .update({ qstash_message_id: messageId })
    .eq("id", summaryId);
  assertNoError(error, "儲存總結排程資訊失敗。");
}

export async function claimEventSummary(summaryId: number): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const normalizedSummaryId = requireFiniteNumber(summaryId, "summaryId");

  const { data, error } = await supabase
    .from("event_summaries")
    .update({
      status: "processing",
      processing_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", normalizedSummaryId)
    .eq("status", "pending")
    .is("processing_at", null)
    .select("id")
    .maybeSingle<{ id: number }>();

  assertNoError(error, "鎖定會議總結任務失敗。");
  return Boolean(data);
}

export async function getEventSummaryProcessingDetails(
  summaryId: number
): Promise<SummaryProcessingDetails | null> {
  const supabase = getSupabaseAdmin();
  const normalizedSummaryId = requireFiniteNumber(summaryId, "summaryId");

  const { data: summary, error: summaryError } = await supabase
    .from("event_summaries")
    .select(
      "id, group_id, requested_by_user_id, source_drive_url, source_drive_file_id, status, processing_at, completed_at, last_error, qstash_message_id"
    )
    .eq("id", normalizedSummaryId)
    .maybeSingle<EventSummaryRow>();
  assertNoError(summaryError, "讀取會議總結任務失敗。");
  if (!summary) return null;

  const { data: group, error: groupError } = await supabase
    .from("chat_groups")
    .select("id, line_group_id, name, picture_url")
    .eq("id", Number(summary.group_id))
    .maybeSingle<ChatGroupRow>();
  assertNoError(groupError, "讀取群組資料失敗。");
  if (!group) {
    throw new RepositoryError("群組資料不存在。", 404, "GROUP_NOT_FOUND");
  }

  const { data: user, error: userError } = await supabase
    .from("line_users")
    .select("id, line_user_id, display_name, picture_url")
    .eq("id", Number(summary.requested_by_user_id))
    .maybeSingle<GroupMemberRow>();
  assertNoError(userError, "讀取 LINE 使用者資料失敗。");
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  return {
    summaryId: Number(summary.id),
    lineGroupId: String(group.line_group_id),
    requestedByLineUserId: String(user.line_user_id),
    sourceDriveUrl: String(summary.source_drive_url),
    sourceDriveFileId: String(summary.source_drive_file_id),
  };
}

export async function markEventSummaryCompleted(input: {
  summaryId: number;
  transcriptText: string;
  summaryJson: unknown;
  summaryText: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const summaryId = requireFiniteNumber(input.summaryId, "summaryId");
  const transcriptText = requireNonEmpty(input.transcriptText, "transcriptText");
  const summaryText = requireNonEmpty(input.summaryText, "summaryText");

  const { error } = await supabase
    .from("event_summaries")
    .update({
      status: "completed",
      transcript_text: transcriptText,
      summary_json: input.summaryJson as never,
      summary_text: summaryText,
      completed_at: new Date().toISOString(),
      processing_at: null,
      last_error: null,
    })
    .eq("id", summaryId);
  assertNoError(error, "儲存會議總結結果失敗。");
}

export async function markEventSummaryFailed(input: {
  summaryId: number;
  message: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const summaryId = requireFiniteNumber(input.summaryId, "summaryId");
  const message = requireNonEmpty(input.message, "message");

  const { error } = await supabase
    .from("event_summaries")
    .update({
      status: "failed",
      processing_at: null,
      last_error: normalizeOptionalText(message),
    })
    .eq("id", summaryId);
  assertNoError(error, "更新會議總結失敗狀態失敗。");
}
