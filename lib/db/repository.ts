import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/db/client";

type ChatGroupRow = {
  id: number;
  line_group_id: string;
  name: string | null;
  picture_url: string | null;
  drive_folder_id: string | null;
};

type LineUserRow = {
  id: number;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
  status_message: string | null;
  language_code: string | null;
  email: string | null;
  google_display_name: string | null;
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
  email: string | null;
  googleDisplayName: string | null;
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
  meeting_url: string | null;
  calendar_event_id: string | null;
};

type ListedEventRow = {
  id: number;
  group_id?: number;
  created_by_user_id: number;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  status: string;
  meeting_url: string | null;
  drive_folder_id: string | null;
  allow_others_to_modify: boolean | null;
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
  reminder_lead_time_minutes: number;
  meeting_url: string | null;
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
  reminderLeadTimeMinutes?: number;
  /** Defaults to true. Pass false to restrict edit/cancel to the creator. */
  allowOthersToModify?: boolean;
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
  meetingUrl: string | null;
  calendarEventId: string | null;
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
  ownerLineUserId: string | null;
  meetingUrl: string | null;
  driveFolderId: string | null;
  allowOthersToModify: boolean;
};

export type UserChatGroup = {
  groupId: number;
  lineGroupId: string;
  name: string | null;
  pictureUrl: string | null;
};

export type ListedEventWithGroup = ListedEvent & {
  lineGroupId: string;
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
  reminderLeadTimeMinutes: number;
  meetingUrl: string | null;
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
  redirectUrl?: string | null;
  summaryId?: number | null;
};

export type CreatedSummary = {
  summaryId: number;
};

export type SummaryProcessingDetails = {
  summaryId: number;
  groupId: number;
  lineGroupId: string;
  requestedByLineUserId: string;
  sourceDriveUrl: string;
  sourceDriveFileId: string;
  eventId: number | null;
};

/** API 回傳給前端的待辦事項格式（camelCase） */
export type TodoItemFromAPI = {
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

/** Supabase 查詢回傳的原始 row 格式（snake_case），僅供 repository 內部使用 */
type TodoItemRow = {
  id: number;
  summary_id: number;
  group_id: number;
  item: string;
  owner: string;
  due: string;
  is_completed: boolean;
  completed_by_user_id: number | null;
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
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
    meetingUrl: row.meeting_url === null ? null : String(row.meeting_url),
    calendarEventId:
      row.calendar_event_id === null ? null : String(row.calendar_event_id),
  };
}

async function getChatGroupByLineGroupId(
  lineGroupId: string
): Promise<ChatGroupRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_groups")
    .select("id, line_group_id, name, picture_url, drive_folder_id")
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
      "id, line_user_id, display_name, picture_url, status_message, language_code, email, google_display_name"
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
  redirect_url?: string | null;
  summary_id?: number | null;
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
  event_id: number | null;
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
    .select("id, line_group_id, name, picture_url, drive_folder_id")
    .single<ChatGroupRow>();

  assertNoError(error, "建立或更新群組資料失敗。");

  if (!data) {
    throw new RepositoryError("群組資料不存在。", 500, "DB_ERROR");
  }

  return data;
}

export async function upsertLineUser(
  input: LineUserProfileInput
): Promise<number> {
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
    return existing.id;
  }

  const { data, error } = await supabase
    .from("line_users")
    .insert({
      line_user_id: lineUserId,
      display_name: displayName,
      picture_url: normalizeOptionalText(input.pictureUrl),
      status_message: normalizeOptionalText(input.statusMessage),
      language_code: normalizeOptionalText(input.languageCode),
      email: normalizeOptionalText(input.email),
    })
    .select("id")
    .single<{ id: number }>();

  assertNoError(error, "建立 LINE 使用者資料失敗。");
  return data!.id;
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

export async function setLineUserEmailByLineUserId(
  lineUserId: string,
  email: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedLineUserId = requireNonEmpty(lineUserId, "lineUserId");
  const normalizedEmail = requireNonEmpty(email, "email");

  const { error } = await supabase
    .from("line_users")
    .update({ email: normalizedEmail })
    .eq("line_user_id", normalizedLineUserId);

  assertNoError(error, "更新 LINE 使用者 email 失敗。");
}

export async function setLineUserGoogleDisplayNameByLineUserId(
  lineUserId: string,
  googleDisplayName: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedLineUserId = requireNonEmpty(lineUserId, "lineUserId");
  const normalizedName = requireNonEmpty(googleDisplayName, "googleDisplayName");

  const { error } = await supabase
    .from("line_users")
    .update({ google_display_name: normalizedName })
    .eq("line_user_id", normalizedLineUserId);

  assertNoError(error, "更新 LINE 使用者 Google 名稱失敗。");
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
    .select("id, line_user_id, display_name, email, google_display_name")
    .in("id", normalizedUserIds)
    .order("display_name", { ascending: true })
    .order("id", { ascending: true });

  assertNoError(error, "讀取 LINE 使用者資料失敗。");

  return (data ?? []).map((row) => ({
    userId: Number(row.id),
    lineUserId: String(row.line_user_id),
    displayName: String(row.display_name),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    googleDisplayName:
      row.google_display_name === null || row.google_display_name === undefined
        ? null
        : String(row.google_display_name),
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
      "id, created_by_user_id, title, description, location, starts_at, ends_at, timezone, status, meeting_url, drive_folder_id, allow_others_to_modify"
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
    .select("id, display_name, line_user_id")
    .in("id", ownerIds);

  assertNoError(ownerError, "讀取活動建立者資料失敗。");

  const groupOwnerRows = (owners ?? []) as Array<{
    id: number;
    display_name: string;
    line_user_id: string;
  }>;
  const ownerMap = new Map<number, string>(
    groupOwnerRows.map((owner) => [Number(owner.id), String(owner.display_name)])
  );
  const groupOwnerLineUserIdMap = new Map<number, string>(
    groupOwnerRows.map((owner) => [Number(owner.id), String(owner.line_user_id)])
  );

  return rows.map((row) => {
    const ownerInternalId = Number(row.created_by_user_id);
    return {
      eventId: Number(row.id),
      title: String(row.title),
      description: row.description === null ? null : String(row.description),
      location: row.location === null ? null : String(row.location),
      startsAt: new Date(row.starts_at).toISOString(),
      endsAt: row.ends_at === null ? null : new Date(row.ends_at).toISOString(),
      timezone: String(row.timezone),
      status: String(row.status),
      ownerDisplayName: ownerMap.get(ownerInternalId) ?? "未知建立者",
      ownerLineUserId: groupOwnerLineUserIdMap.get(ownerInternalId) ?? null,
      meetingUrl: row.meeting_url === null ? null : String(row.meeting_url),
      driveFolderId:
        row.drive_folder_id === null ? null : String(row.drive_folder_id),
      allowOthersToModify: row.allow_others_to_modify !== false,
    };
  });
}

export async function listUserGroups(lineUserId: string): Promise<UserChatGroup[]> {
  const supabase = getSupabaseAdmin();
  const normalizedLineUserId = requireNonEmpty(lineUserId, "lineUserId");
  const user = await getLineUserByLineUserId(normalizedLineUserId);
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const { data, error } = await supabase
    .from("group_memberships")
    .select("group_id, chat_groups(id, line_group_id, name, picture_url, drive_folder_id)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  assertNoError(error, "讀取使用者群組資料失敗。");

  return (data ?? [])
    .map((row) => {
      const embedded = (row as { chat_groups?: ChatGroupRow[] | ChatGroupRow | null })
        .chat_groups;
      const group = Array.isArray(embedded) ? embedded[0] ?? null : embedded ?? null;
      if (!group) return null;
      return {
        groupId: Number(group.id),
        lineGroupId: String(group.line_group_id),
        name: group.name === null ? null : String(group.name),
        pictureUrl: group.picture_url === null ? null : String(group.picture_url),
      } satisfies UserChatGroup;
    })
    .filter((x): x is UserChatGroup => Boolean(x))
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "zh-Hant"));
}

export async function listEventsByGroupIds(input: {
  groups: UserChatGroup[];
  rangeStart?: string | null;
  rangeEnd?: string | null;
}): Promise<ListedEventWithGroup[]> {
  const supabase = getSupabaseAdmin();
  const groupIds = [...new Set(input.groups.map((g) => Number(g.groupId)))].filter(
    Number.isFinite
  );
  if (groupIds.length === 0) return [];

  const groupLineIdById = new Map<number, string>(
    input.groups.map((g) => [Number(g.groupId), String(g.lineGroupId)])
  );

  let query = supabase
    .from("events")
    .select(
      "id, group_id, created_by_user_id, title, description, location, starts_at, ends_at, timezone, status, meeting_url, drive_folder_id, allow_others_to_modify"
    )
    .in("group_id", groupIds)
    .eq("status", "scheduled")
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true });

  if (input.rangeStart) {
    const start = parseEventDate(input.rangeStart, "rangeStart");
    query = query.gte("starts_at", start.toISOString());
  }
  if (input.rangeEnd) {
    const end = parseEventDate(input.rangeEnd, "rangeEnd");
    query = query.lt("starts_at", end.toISOString());
  }

  const { data: events, error: eventError } = await query;
  assertNoError(eventError, "讀取活動清單失敗。");

  const rows = (events ?? []) as ListedEventRow[];
  if (rows.length === 0) return [];

  const ownerIds = [...new Set(rows.map((row) => Number(row.created_by_user_id)))].filter(
    Number.isFinite
  );
  const { data: owners, error: ownerError } = await supabase
    .from("line_users")
    .select("id, display_name, line_user_id")
    .in("id", ownerIds);
  assertNoError(ownerError, "讀取活動建立者資料失敗。");

  const ownerRows = (owners ?? []) as Array<{
    id: number;
    display_name: string;
    line_user_id: string;
  }>;
  const ownerMap = new Map<number, string>(
    ownerRows.map((owner) => [Number(owner.id), String(owner.display_name)])
  );
  const ownerLineUserIdMap = new Map<number, string>(
    ownerRows.map((owner) => [Number(owner.id), String(owner.line_user_id)])
  );

  return rows
    .map((row) => {
      const groupId = Number((row as { group_id?: unknown }).group_id);
      const lineGroupId = groupLineIdById.get(groupId);
      if (!lineGroupId) return null;
      const ownerInternalId = Number(row.created_by_user_id);
      return {
        lineGroupId,
        eventId: Number(row.id),
        title: String(row.title),
        description: row.description === null ? null : String(row.description),
        location: row.location === null ? null : String(row.location),
        startsAt: new Date(row.starts_at).toISOString(),
        endsAt: row.ends_at === null ? null : new Date(row.ends_at).toISOString(),
        timezone: String(row.timezone),
        status: String(row.status),
        ownerDisplayName: ownerMap.get(ownerInternalId) ?? "未知建立者",
        ownerLineUserId: ownerLineUserIdMap.get(ownerInternalId) ?? null,
        meetingUrl: row.meeting_url === null ? null : String(row.meeting_url),
        driveFolderId:
          row.drive_folder_id === null ? null : String(row.drive_folder_id),
        allowOthersToModify: row.allow_others_to_modify !== false,
      } satisfies ListedEventWithGroup;
    })
    .filter((x): x is ListedEventWithGroup => Boolean(x));
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
      "id, group_id, title, description, location, starts_at, timezone, status, reminder_message_id, reminder_scheduled_at, reminder_processing_at, reminder_sent_at, reminder_last_error, reminder_lead_time_minutes, meeting_url"
    )
    .eq("id", normalizedEventId)
    .maybeSingle<EventReminderEventRow>();

  assertNoError(eventError, "讀取提醒活動失敗。");

  if (!event) {
    return null;
  }

  const { data: group, error: groupError } = await supabase
    .from("chat_groups")
    .select("id, line_group_id, name, picture_url, drive_folder_id")
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
    reminderLeadTimeMinutes: Number(event.reminder_lead_time_minutes) || 5,
    meetingUrl: event.meeting_url === null ? null : String(event.meeting_url),
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

  const leadTimeMinutes =
    typeof input.reminderLeadTimeMinutes === "number" &&
    Number.isFinite(input.reminderLeadTimeMinutes) &&
    input.reminderLeadTimeMinutes > 0
      ? Math.round(input.reminderLeadTimeMinutes)
      : 5;

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
      p_reminder_lead_time_minutes: leadTimeMinutes,
    })
    .single<CreatedEventRow>();

  assertNoError(error, "建立活動失敗。");

  if (!data) {
    throw new RepositoryError("建立活動失敗。", 500, "DB_ERROR");
  }

  // Default is TRUE in DB; only persist when the caller explicitly opts out.
  if (input.allowOthersToModify === false) {
    const { error: flagError } = await supabase
      .from("events")
      .update({ allow_others_to_modify: false })
      .eq("id", Number(data.event_id));
    assertNoError(flagError, "更新活動權限設定失敗。");
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
  const redirectUrl = normalizeOptionalText(input.redirectUrl);
  const summaryId =
    typeof input.summaryId === "number" ? requireFiniteNumber(input.summaryId, "summaryId") : null;

  const user = await getLineUserByLineUserId(lineUserId);
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const { error } = await supabase.from("google_oauth_states").insert({
    state,
    user_id: user.id,
    expires_at: expiresAt.toISOString(),
    redirect_url: redirectUrl,
    summary_id: summaryId,
  });
  assertNoError(error, "建立 Google OAuth state 失敗。");
}

export async function consumeGoogleOAuthState(
  state: string
): Promise<{ lineUserId: string; redirectUrl: string | null; summaryId: number | null } | null> {
  const supabase = getSupabaseAdmin();
  const normalizedState = requireNonEmpty(state, "state");

  const { data, error } = await supabase
    .from("google_oauth_states")
    .select("state, user_id, expires_at, used_at, redirect_url, summary_id")
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

  return {
    lineUserId: String(user.line_user_id),
    redirectUrl:
      data.redirect_url === null || typeof data.redirect_url === "undefined"
        ? null
        : String(data.redirect_url),
    summaryId:
      typeof data.summary_id === "number" && Number.isFinite(Number(data.summary_id))
        ? Number(data.summary_id)
        : null,
  };
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

/**
 * Marks the user's Google credential as revoked so it is no longer returned by
 * {@link getGoogleCredentialByLineUserId}. Call this when Google rejects the
 * refresh token with `invalid_grant` — the next credential lookup returns null,
 * which makes the existing re-prompt paths fire. Idempotent / no-op if there is
 * no active credential.
 */
export async function markGoogleCredentialRevoked(
  lineUserId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedLineUserId = requireNonEmpty(lineUserId, "lineUserId");
  const user = await getLineUserByLineUserId(normalizedLineUserId);
  if (!user) return;

  const { error } = await supabase
    .from("google_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  assertNoError(error, "標記 Google 憑證失效失敗。");
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
    eventId?: number | null;
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

  const eventId =
    typeof input.eventId === "number" && Number.isFinite(input.eventId)
      ? requireFiniteNumber(input.eventId, "eventId")
      : null;

  const { data, error } = await supabase
    .from("event_summaries")
    .insert({
      group_id: group.id,
      requested_by_user_id: user.id,
      source_drive_url: sourceDriveUrl,
      source_drive_file_id: sourceDriveFileId,
      event_id: eventId,
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
      "id, group_id, requested_by_user_id, source_drive_url, source_drive_file_id, status, processing_at, completed_at, last_error, qstash_message_id, event_id"
    )
    .eq("id", normalizedSummaryId)
    .maybeSingle<EventSummaryRow>();
  assertNoError(summaryError, "讀取會議總結任務失敗。");
  if (!summary) return null;

  const { data: group, error: groupError } = await supabase
    .from("chat_groups")
    .select("id, line_group_id, name, picture_url, drive_folder_id")
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
    groupId: Number(summary.group_id),
    lineGroupId: String(group.line_group_id),
    requestedByLineUserId: String(user.line_user_id),
    sourceDriveUrl: String(summary.source_drive_url),
    sourceDriveFileId: String(summary.source_drive_file_id),
    eventId:
      typeof summary.event_id === "number" && Number.isFinite(Number(summary.event_id))
        ? Number(summary.event_id)
        : null,
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

export async function updateEventCalendarData(input: {
  eventId: number;
  meetingUrl: string;
  calendarEventId: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const eventId = requireFiniteNumber(input.eventId, "eventId");
  const meetingUrl = requireNonEmpty(input.meetingUrl, "meetingUrl");
  const calendarEventId = requireNonEmpty(input.calendarEventId, "calendarEventId");

  const { error } = await supabase
    .from("events")
    .update({ meeting_url: meetingUrl, calendar_event_id: calendarEventId })
    .eq("id", eventId);
  assertNoError(error, "儲存 Google 日曆資訊失敗。");
}

export function hasCalendarScope(credential: GoogleCredential): boolean {
  const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
  const tokens = (credential.scopes ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return tokens.includes(CALENDAR_SCOPE);
}

export type EventAutoSummaryDetails = {
  eventId: number;
  lineGroupId: string;
  createdByLineUserId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  autoSummaryCompletedAt: string | null;
};

type EventAutoSummaryRow = {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  auto_summary_completed_at: string | null;
  group_id: number;
  created_by_user_id: number;
};

export async function getEventAutoSummaryDetails(
  eventId: number
): Promise<EventAutoSummaryDetails | null> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = requireFiniteNumber(eventId, "eventId");

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "id, group_id, created_by_user_id, title, starts_at, ends_at, status, auto_summary_completed_at"
    )
    .eq("id", normalizedEventId)
    .maybeSingle<EventAutoSummaryRow>();
  assertNoError(eventError, "讀取活動資料失敗。");
  if (!event) return null;

  const { data: group, error: groupError } = await supabase
    .from("chat_groups")
    .select("line_group_id")
    .eq("id", Number(event.group_id))
    .maybeSingle<{ line_group_id: string }>();
  assertNoError(groupError, "讀取群組資料失敗。");
  if (!group) return null;

  const { data: user, error: userError } = await supabase
    .from("line_users")
    .select("line_user_id")
    .eq("id", Number(event.created_by_user_id))
    .maybeSingle<{ line_user_id: string }>();
  assertNoError(userError, "讀取 LINE 使用者資料失敗。");
  if (!user) return null;

  return {
    eventId: Number(event.id),
    lineGroupId: String(group.line_group_id),
    createdByLineUserId: String(user.line_user_id),
    title: String(event.title),
    startsAt: new Date(event.starts_at).toISOString(),
    endsAt:
      event.ends_at === null ? null : new Date(event.ends_at).toISOString(),
    status: String(event.status),
    autoSummaryCompletedAt:
      event.auto_summary_completed_at === null
        ? null
        : new Date(event.auto_summary_completed_at).toISOString(),
  };
}

export async function setEventAutoSummarySchedule(input: {
  eventId: number;
  messageId: string;
  scheduledAt: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const eventId = requireFiniteNumber(input.eventId, "eventId");
  const messageId = requireNonEmpty(input.messageId, "messageId");
  const scheduledAt = parseEventDate(input.scheduledAt, "scheduledAt");

  const { error } = await supabase
    .from("events")
    .update({
      auto_summary_qstash_message_id: messageId,
      auto_summary_scheduled_at: scheduledAt.toISOString(),
      auto_summary_last_error: null,
    })
    .eq("id", eventId);
  assertNoError(error, "儲存自動摘要排程失敗。");
}

export async function incrementEventAutoSummaryAttempt(
  eventId: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = requireFiniteNumber(eventId, "eventId");

  const { data, error: readError } = await supabase
    .from("events")
    .select("auto_summary_attempt_count")
    .eq("id", normalizedEventId)
    .maybeSingle<{ auto_summary_attempt_count: number | null }>();
  assertNoError(readError, "讀取自動摘要重試次數失敗。");

  const current = Number(data?.auto_summary_attempt_count ?? 0);
  const { error } = await supabase
    .from("events")
    .update({ auto_summary_attempt_count: current + 1 })
    .eq("id", normalizedEventId);
  assertNoError(error, "更新自動摘要重試次數失敗。");
}

export async function markEventAutoSummaryCompleted(
  eventId: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = requireFiniteNumber(eventId, "eventId");

  const { error } = await supabase
    .from("events")
    .update({
      auto_summary_completed_at: new Date().toISOString(),
      auto_summary_last_error: null,
    })
    .eq("id", normalizedEventId);
  assertNoError(error, "標記自動摘要完成失敗。");
}

export async function markEventAutoSummaryFailed(
  eventId: number,
  message: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = requireFiniteNumber(eventId, "eventId");

  const { error } = await supabase
    .from("events")
    .update({
      auto_summary_last_error: normalizeOptionalText(message),
    })
    .eq("id", normalizedEventId);
  assertNoError(error, "標記自動摘要失敗狀態失敗。");
}

export async function hasActiveSummaryForEvent(eventId: number): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = requireFiniteNumber(eventId, "eventId");

  const { data, error } = await supabase
    .from("event_summaries")
    .select("id")
    .eq("event_id", normalizedEventId)
    .in("status", ["pending", "processing", "completed"])
    .limit(1);
  assertNoError(error, "查詢活動摘要狀態失敗。");
  return (data ?? []).length > 0;
}

export async function getProcessedDriveFileIds(): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("event_summaries")
    .select("source_drive_file_id")
    .in("status", ["pending", "processing", "completed"]);
  assertNoError(error, "讀取已處理逐字稿檔案失敗。");

  return new Set(
    (data ?? [])
      .map((row) =>
        typeof (row as { source_drive_file_id?: unknown }).source_drive_file_id ===
        "string"
          ? String((row as { source_drive_file_id: string }).source_drive_file_id)
          : null
      )
      .filter((id): id is string => Boolean(id))
  );
}

// ---------------------------------------------------------------------------
// Todo Items
// ---------------------------------------------------------------------------

export async function listEventAttendeeUserIds(eventId: number): Promise<number[]> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = requireFiniteNumber(eventId, "eventId");

  const { data, error } = await supabase
    .from("event_attendees")
    .select("user_id")
    .eq("event_id", normalizedEventId)
    .order("user_id", { ascending: true });
  assertNoError(error, "讀取活動參與者失敗。");

  return [...new Set(
    ((data ?? []) as EventReminderAttendeeRow[])
      .map((row) => Number(row.user_id))
      .filter(Number.isFinite)
  )];
}

export async function listTodoOwnerCandidatesForSummary(input: {
  lineGroupId: string;
  eventId?: number | null;
}): Promise<
  Array<{
    userId: number;
    lineUserId: string;
    displayName: string;
    email: string | null;
    googleDisplayName: string | null;
  }>
> {
  const userIds = new Set<number>();

  if (typeof input.eventId === "number" && Number.isFinite(input.eventId)) {
    for (const userId of await listEventAttendeeUserIds(input.eventId)) {
      userIds.add(userId);
    }
  }

  try {
    const groupMembers = await listActiveGroupMembers(input.lineGroupId);
    for (const member of groupMembers) {
      userIds.add(member.userId);
    }
  } catch (error) {
    if (!(error instanceof RepositoryError && error.code === "GROUP_NOT_FOUND")) {
      throw error;
    }
  }

  if (userIds.size === 0) {
    return [];
  }

  return listLineUsersByIds([...userIds]);
}

export async function listActiveGroupMembersWithEmail(
  lineGroupId: string
): Promise<(GroupMember & { email: string | null; googleDisplayName: string | null })[]> {
  const members = await listActiveGroupMembers(lineGroupId);
  if (members.length === 0) return [];

  const refs = await listLineUsersByIds(members.map((member) => member.userId));
  const profileMap = new Map(refs.map((ref) => [ref.userId, ref]));

  return members.map((member) => ({
    ...member,
    email: profileMap.get(member.userId)?.email ?? null,
    googleDisplayName: profileMap.get(member.userId)?.googleDisplayName ?? null,
  }));
}

export async function createTodoItemsFromSummary(input: {
  summaryId: number;
  groupId: number;
  items: {
    item: string;
    owner: string;
    due: string;
    assignedUserIds?: number[];
  }[];
}): Promise<void> {
  if (input.items.length === 0) return;

  const supabase = getSupabaseAdmin();
  const summaryId = requireFiniteNumber(input.summaryId, "summaryId");
  const groupId = requireFiniteNumber(input.groupId, "groupId");

  const rows = input.items.map((i) => ({
    summary_id: summaryId,
    group_id: groupId,
    item: i.item,
    owner: i.owner ?? "",
    due: i.due ?? "",
  }));

  const { data, error } = await supabase
    .from("todo_items")
    .insert(rows)
    .select("id");
  assertNoError(error, "建立待辦事項失敗。");

  const inserted = (data ?? []) as { id: number }[];
  for (let index = 0; index < inserted.length; index += 1) {
    const assignedUserIds = input.items[index]?.assignedUserIds ?? [];
    if (assignedUserIds.length === 0) continue;
    await syncTodoAssignees(supabase, Number(inserted[index]?.id), assignedUserIds);
  }
}

async function syncTodoAssignees(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  todoId: number,
  userIds: number[]
) {
  const { error: delErr } = await supabase
    .from("todo_item_assignees")
    .delete()
    .eq("todo_id", todoId);
  assertNoError(delErr, "清除指派成員失敗。");

  if (userIds.length > 0) {
    const rows = userIds.map((uid) => ({ todo_id: todoId, user_id: uid }));
    const { error: insErr } = await supabase
      .from("todo_item_assignees")
      .insert(rows);
    assertNoError(insErr, "指派成員失敗。");
  }
}

export async function createTodoItem(input: {
  lineUserId: string;
  groupId: number;
  item: string;
  due?: string;
  assignedUserIds?: number[];
}): Promise<TodoItemFromAPI | null> {
  const supabase = getSupabaseAdmin();
  const lineUserId = requireNonEmpty(input.lineUserId, "lineUserId");
  const groupId = requireFiniteNumber(input.groupId, "groupId");
  const item = requireNonEmpty(input.item, "item");

  const user = await getLineUserByLineUserId(lineUserId);
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const membership = await getActiveMembership(groupId, user.id);
  if (!membership) {
    throw new RepositoryError("你不是此群組的有效成員。", 403, "FORBIDDEN");
  }

  const row: Record<string, unknown> = {
    group_id: groupId,
    item,
    owner: user.display_name ?? "",
  };
  if (input.due) row.due = input.due;

  const { data, error } = await supabase
    .from("todo_items")
    .insert(row)
    .select("id")
    .single<{ id: number }>();
  assertNoError(error, "建立待辦事項失敗。");
  if (!data) return null;

  if (input.assignedUserIds && input.assignedUserIds.length > 0) {
    await syncTodoAssignees(supabase, data.id, input.assignedUserIds);
  }

  const result = await listTodoItemsByGroupIds([groupId]);
  return result.find((r) => r.id === data.id) ?? null;
}

export async function listTodoItemsByGroupIds(
  groupIds: number[]
): Promise<TodoItemFromAPI[]> {
  const supabase = getSupabaseAdmin();
  const ids = [...new Set(groupIds.map(Number))].filter(Number.isFinite);
  if (ids.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("todo_items")
    .select(
      "id, summary_id, group_id, item, owner, due, is_completed, completed_at, created_at"
    )
    .in("group_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  assertNoError(error, "讀取待辦事項失敗。");

  const items = (rows ?? []) as TodoItemRow[];
  if (items.length === 0) return [];

  const todoIds = items.map((r) => Number(r.id));
  const summaryIds = [...new Set(
    items.map((r) => r.summary_id != null ? Number(r.summary_id) : NaN)
  )].filter(Number.isFinite);
  const groupIdSet = [...new Set(items.map((r) => Number(r.group_id)))].filter(
    Number.isFinite
  );

  const { data: assigneeRows, error: assigneeErr } = await supabase
    .from("todo_item_assignees")
    .select("todo_id, user_id")
    .in("todo_id", todoIds);
  assertNoError(assigneeErr, "讀取指派成員失敗。");

  const assigneeUserIds = [
    ...new Set(
      ((assigneeRows ?? []) as { todo_id: number; user_id: number }[]).map((r) => Number(r.user_id))
    ),
  ].filter(Number.isFinite);

  let userNameMap = new Map<number, string>();
  if (assigneeUserIds.length > 0) {
    const { data: users, error: usrErr } = await supabase
      .from("line_users")
      .select("id, display_name")
      .in("id", assigneeUserIds);
    assertNoError(usrErr, "讀取指派使用者失敗。");
    userNameMap = new Map(
      ((users ?? []) as { id: number; display_name: string }[]).map((u) => [
        Number(u.id),
        String(u.display_name),
      ])
    );
  }

  const todoAssigneesMap = new Map<number, { userId: number; displayName: string }[]>();
  for (const r of (assigneeRows ?? []) as { todo_id: number; user_id: number }[]) {
    const tid = Number(r.todo_id);
    const uid = Number(r.user_id);
    if (!todoAssigneesMap.has(tid)) todoAssigneesMap.set(tid, []);
    todoAssigneesMap.get(tid)!.push({
      userId: uid,
      displayName: userNameMap.get(uid) ?? "未知使用者",
    });
  }

  const { data: summaries, error: sumErr } = await supabase
    .from("event_summaries")
    .select("id, summary_json")
    .in("id", summaryIds.length > 0 ? summaryIds : [0]);
  assertNoError(sumErr, "讀取會議總結失敗。");

  const topicMap = new Map<number, string>();
  for (const s of (summaries ?? []) as { id: number; summary_json: { topic?: string } | null }[]) {
    topicMap.set(Number(s.id), s.summary_json?.topic ?? "未知會議");
  }

  const { data: groups, error: grpErr } = await supabase
    .from("chat_groups")
    .select("id, line_group_id, name")
    .in("id", groupIdSet);
  assertNoError(grpErr, "讀取群組資料失敗。");

  const groupLineIdMap = new Map<number, string>(
    ((groups ?? []) as { id: number; line_group_id: string; name: string | null }[]).map((g) => [
      Number(g.id),
      String(g.line_group_id),
    ])
  );

  const groupNameMap = new Map<number, string>(
    ((groups ?? []) as { id: number; line_group_id: string; name: string | null }[]).map((g) => [
      Number(g.id),
      g.name?.trim() || "未命名群組",
    ])
  );

  return items
    .map((row) => {
      const lineGroupId = groupLineIdMap.get(Number(row.group_id));
      if (!lineGroupId) return null;
      return {
        id: Number(row.id),
        summaryId: row.summary_id != null ? Number(row.summary_id) : null,
        groupId: Number(row.group_id),
        lineGroupId,
        groupName: groupNameMap.get(Number(row.group_id)) ?? "未命名群組",
        meetingTitle: row.summary_id != null
          ? topicMap.get(Number(row.summary_id)) ?? "未知會議"
          : "",
        item: String(row.item),
        owner: String(row.owner),
        assignedUsers: todoAssigneesMap.get(Number(row.id)) ?? [],
        due: String(row.due),
        isCompleted: Boolean(row.is_completed),
        completedAt: row.completed_at ?? null,
        createdAt: String(row.created_at),
      } satisfies TodoItemFromAPI;
    })
    .filter((x): x is TodoItemFromAPI => Boolean(x));
}

export async function toggleTodoItemCompleted(input: {
  id: number;
  lineUserId: string;
  isCompleted: boolean;
}): Promise<TodoItemFromAPI | null> {
  const supabase = getSupabaseAdmin();
  const todoId = requireFiniteNumber(input.id, "id");
  const lineUserId = requireNonEmpty(input.lineUserId, "lineUserId");

  const user = await getLineUserByLineUserId(lineUserId);
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("todo_items")
    .select("id, group_id")
    .eq("id", todoId)
    .is("deleted_at", null)
    .maybeSingle<{ id: number; group_id: number }>();
  assertNoError(fetchErr, "讀取待辦事項失敗。");
  if (!existing) return null;

  const membership = await getActiveMembership(existing.group_id, user.id);
  if (!membership) {
    throw new RepositoryError("你不是此群組的有效成員。", 403, "FORBIDDEN");
  }

  const { error: updateErr } = await supabase
    .from("todo_items")
    .update({
      is_completed: input.isCompleted,
      completed_by_user_id: input.isCompleted ? user.id : null,
      completed_at: input.isCompleted ? new Date().toISOString() : null,
    })
    .eq("id", todoId);
  assertNoError(updateErr, "更新待辦事項狀態失敗。");

  const result = await listTodoItemsByGroupIds([existing.group_id]);
  return result.find((r) => r.id === todoId) ?? null;
}

export async function updateTodoItem(input: {
  id: number;
  lineUserId: string;
  item?: string;
  due?: string;
  groupId?: number;
  assignedUserIds?: number[];
}): Promise<TodoItemFromAPI | null> {
  const supabase = getSupabaseAdmin();
  const todoId = requireFiniteNumber(input.id, "id");
  const lineUserId = requireNonEmpty(input.lineUserId, "lineUserId");

  const user = await getLineUserByLineUserId(lineUserId);
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("todo_items")
    .select("id, group_id")
    .eq("id", todoId)
    .is("deleted_at", null)
    .maybeSingle<{ id: number; group_id: number }>();
  assertNoError(fetchErr, "讀取待辦事項失敗。");
  if (!existing) return null;

  const membership = await getActiveMembership(existing.group_id, user.id);
  if (!membership) {
    throw new RepositoryError("你不是此群組的有效成員。", 403, "FORBIDDEN");
  }

  const updates: Record<string, unknown> = {};
  if (typeof input.item === "string") updates.item = input.item;
  if (typeof input.due === "string") updates.due = input.due;
  if (input.groupId !== undefined) {
    const newGroupId = requireFiniteNumber(input.groupId, "groupId");
    const newMembership = await getActiveMembership(newGroupId, user.id);
    if (!newMembership) {
      throw new RepositoryError("你不是目標群組的有效成員。", 403, "FORBIDDEN");
    }
    updates.group_id = newGroupId;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateErr } = await supabase
      .from("todo_items")
      .update(updates)
      .eq("id", todoId);
    assertNoError(updateErr, "更新待辦事項失敗。");
  }

  if (input.assignedUserIds !== undefined) {
    await syncTodoAssignees(supabase, todoId, input.assignedUserIds);
  }

  const finalGroupId = input.groupId ?? existing.group_id;
  const result = await listTodoItemsByGroupIds([finalGroupId]);
  return result.find((r) => r.id === todoId) ?? null;
}

export async function deleteTodoItem(input: {
  id: number;
  lineUserId: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const todoId = requireFiniteNumber(input.id, "id");
  const lineUserId = requireNonEmpty(input.lineUserId, "lineUserId");

  const user = await getLineUserByLineUserId(lineUserId);
  if (!user) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("todo_items")
    .select("id, group_id")
    .eq("id", todoId)
    .is("deleted_at", null)
    .maybeSingle<{ id: number; group_id: number }>();
  assertNoError(fetchErr, "讀取待辦事項失敗。");
  if (!existing) return false;

  const membership = await getActiveMembership(existing.group_id, user.id);
  if (!membership) {
    throw new RepositoryError("你不是此群組的有效成員。", 403, "FORBIDDEN");
  }

  const { data, error: deleteErr } = await supabase
    .from("todo_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", todoId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: number }>();
  assertNoError(deleteErr, "刪除待辦事項失敗。");
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Drive Folders
// ---------------------------------------------------------------------------

export async function upsertGroupDriveFolderId(
  lineGroupId: string,
  driveFolderId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const trimmedGroupId = requireNonEmpty(lineGroupId, "lineGroupId");
  const trimmedFolderId = requireNonEmpty(driveFolderId, "driveFolderId");
  const { error } = await supabase
    .from("chat_groups")
    .upsert(
      { line_group_id: trimmedGroupId, drive_folder_id: trimmedFolderId },
      { onConflict: "line_group_id" }
    );
  assertNoError(error, "更新群組 Drive 資料夾 ID 失敗。");
}

export async function getGroupDriveFolderId(
  lineGroupId: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const trimmedGroupId = requireNonEmpty(lineGroupId, "lineGroupId");
  const { data, error } = await supabase
    .from("chat_groups")
    .select("drive_folder_id")
    .eq("line_group_id", trimmedGroupId)
    .maybeSingle<{ drive_folder_id: string | null }>();
  assertNoError(error, "讀取群組 Drive 資料夾 ID 失敗。");
  return data?.drive_folder_id ?? null;
}

export async function setEventDriveFolderId(
  eventId: number,
  driveFolderId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = requireFiniteNumber(eventId, "eventId");
  const trimmedFolderId = requireNonEmpty(driveFolderId, "driveFolderId");
  const { error } = await supabase
    .from("events")
    .update({ drive_folder_id: trimmedFolderId })
    .eq("id", normalizedEventId);
  assertNoError(error, "更新活動 Drive 資料夾 ID 失敗。");
}

export type MutableEventContext = {
  eventId: number;
  groupId: number;
  lineGroupId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  timezone: string;
  status: string;
  reminderMessageId: string | null;
  reminderLeadTimeMinutes: number;
  autoSummaryMessageId: string | null;
  calendarEventId: string | null;
  meetingUrl: string | null;
  creatorLineUserId: string;
  allowOthersToModify: boolean;
  /** True when the requester is the event creator. */
  requesterIsCreator: boolean;
};

type MutableEventRow = {
  id: number;
  group_id: number;
  created_by_user_id: number;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  timezone: string;
  status: string;
  reminder_message_id: string | null;
  reminder_lead_time_minutes: number | null;
  auto_summary_qstash_message_id: string | null;
  calendar_event_id: string | null;
  meeting_url: string | null;
  allow_others_to_modify: boolean | null;
};

/** 取得事件變更（取消／編輯）所需的所有 metadata，並驗證 requester 是事件所屬群組的有效成員。 */
async function loadMutableEventForUser(
  eventId: number,
  requesterLineUserId: string
): Promise<MutableEventContext> {
  const supabase = getSupabaseAdmin();
  const normalizedEventId = requireFiniteNumber(eventId, "eventId");

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select(
      "id, group_id, created_by_user_id, title, description, location, starts_at, timezone, status, reminder_message_id, reminder_lead_time_minutes, auto_summary_qstash_message_id, calendar_event_id, meeting_url, allow_others_to_modify"
    )
    .eq("id", normalizedEventId)
    .maybeSingle<MutableEventRow>();
  assertNoError(eventError, "讀取活動失敗。");
  if (!eventRow) {
    throw new RepositoryError("找不到活動。", 404, "EVENT_NOT_FOUND");
  }

  const requester = await getLineUserByLineUserId(requesterLineUserId);
  if (!requester) {
    throw new RepositoryError("找不到對應的 LINE 使用者資料。", 404, "USER_NOT_FOUND");
  }

  const membership = await getActiveMembership(Number(eventRow.group_id), Number(requester.id));
  if (!membership) {
    throw new RepositoryError("你不是此群組的有效成員。", 403, "FORBIDDEN");
  }

  const { data: group, error: groupError } = await supabase
    .from("chat_groups")
    .select("id, line_group_id")
    .eq("id", Number(eventRow.group_id))
    .maybeSingle<{ id: number; line_group_id: string }>();
  assertNoError(groupError, "讀取群組資料失敗。");
  if (!group) {
    throw new RepositoryError("群組資料不存在。", 404, "GROUP_NOT_FOUND");
  }

  const { data: creator, error: creatorError } = await supabase
    .from("line_users")
    .select("line_user_id")
    .eq("id", Number(eventRow.created_by_user_id))
    .maybeSingle<{ line_user_id: string }>();
  assertNoError(creatorError, "讀取活動建立者資料失敗。");

  const allowOthersToModify = eventRow.allow_others_to_modify !== false; // null/undefined → true
  const requesterIsCreator = Number(requester.id) === Number(eventRow.created_by_user_id);
  if (!requesterIsCreator && !allowOthersToModify) {
    throw new RepositoryError(
      "只有會議建立者可以編輯或取消這場會議。",
      403,
      "FORBIDDEN"
    );
  }

  return {
    eventId: Number(eventRow.id),
    groupId: Number(eventRow.group_id),
    lineGroupId: String(group.line_group_id),
    title: String(eventRow.title),
    description: eventRow.description === null ? null : String(eventRow.description),
    location: eventRow.location === null ? null : String(eventRow.location),
    startsAt: new Date(eventRow.starts_at).toISOString(),
    timezone: String(eventRow.timezone),
    status: String(eventRow.status),
    reminderMessageId:
      eventRow.reminder_message_id === null ? null : String(eventRow.reminder_message_id),
    reminderLeadTimeMinutes: Number(eventRow.reminder_lead_time_minutes) || 5,
    autoSummaryMessageId:
      eventRow.auto_summary_qstash_message_id === null
        ? null
        : String(eventRow.auto_summary_qstash_message_id),
    calendarEventId:
      eventRow.calendar_event_id === null ? null : String(eventRow.calendar_event_id),
    meetingUrl: eventRow.meeting_url === null ? null : String(eventRow.meeting_url),
    creatorLineUserId: creator?.line_user_id ? String(creator.line_user_id) : "",
    allowOthersToModify,
    requesterIsCreator,
  };
}

/** 取消活動：把 status 設為 'cancelled'，並清掉已排程的訊息 ID。回傳變更前的 metadata 供外部清理副作用使用。 */
/** 取得每個 event 最新一筆 status='completed' 的摘要文字（給 dashboard 顯示用）。 */
export async function listLatestCompletedSummariesByEventIds(
  eventIds: number[]
): Promise<Map<number, string>> {
  if (eventIds.length === 0) return new Map();
  const supabase = getSupabaseAdmin();
  const normalized = [...new Set(eventIds.map(Number))].filter(Number.isFinite);
  if (normalized.length === 0) return new Map();

  const { data, error } = await supabase
    .from("event_summaries")
    .select("event_id, summary_text, completed_at")
    .in("event_id", normalized)
    .eq("status", "completed")
    .not("summary_text", "is", null)
    .order("completed_at", { ascending: false });
  assertNoError(error, "讀取會議摘要失敗。");

  const map = new Map<number, string>();
  for (const row of (data ?? []) as Array<{
    event_id: number;
    summary_text: string | null;
  }>) {
    const eventId = Number(row.event_id);
    if (!Number.isFinite(eventId)) continue;
    if (map.has(eventId)) continue; // already have the latest (sorted desc)
    if (!row.summary_text) continue;
    map.set(eventId, String(row.summary_text));
  }
  return map;
}

export async function cancelEventForUser(input: {
  eventId: number;
  requesterLineUserId: string;
}): Promise<MutableEventContext> {
  const context = await loadMutableEventForUser(input.eventId, input.requesterLineUserId);
  if (context.status === "cancelled") {
    return context;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("events")
    .update({
      status: "cancelled",
      reminder_message_id: null,
      reminder_scheduled_at: null,
      auto_summary_qstash_message_id: null,
      auto_summary_scheduled_at: null,
    })
    .eq("id", context.eventId);
  assertNoError(error, "取消活動失敗。");

  return context;
}

export type EventUpdatableFields = {
  title?: string;
  startsAt?: string;
  location?: string | null;
  description?: string | null;
  /** Creator-only. Non-creator requests with this field set will be rejected. */
  allowOthersToModify?: boolean;
};

export type UpdatedEventResult = {
  previous: MutableEventContext;
  next: MutableEventContext;
  timeChanged: boolean;
};

/** 編輯活動（限 title / startsAt / location / description）。回傳變更前後的 metadata 與時間是否變動。 */
export async function updateEventForUser(input: {
  eventId: number;
  requesterLineUserId: string;
  fields: EventUpdatableFields;
}): Promise<UpdatedEventResult> {
  const previous = await loadMutableEventForUser(input.eventId, input.requesterLineUserId);
  if (previous.status === "cancelled") {
    throw new RepositoryError("已取消的活動無法修改。", 400, "INVALID_STATE");
  }

  const patch: Record<string, unknown> = {};
  let timeChanged = false;

  if (input.fields.title !== undefined) {
    const trimmed = input.fields.title.trim();
    if (!trimmed) {
      throw new RepositoryError("會議主題不可為空。", 400, "INVALID_INPUT");
    }
    patch.title = trimmed;
  }
  if (input.fields.startsAt !== undefined) {
    const date = new Date(input.fields.startsAt);
    if (Number.isNaN(date.getTime())) {
      throw new RepositoryError("startsAt 格式不正確。", 400, "INVALID_INPUT");
    }
    const nextIso = date.toISOString();
    if (nextIso !== previous.startsAt) {
      patch.starts_at = nextIso;
      timeChanged = true;
    }
  }
  if (input.fields.location !== undefined) {
    patch.location = input.fields.location?.trim() ? input.fields.location.trim() : null;
  }
  if (input.fields.description !== undefined) {
    patch.description = input.fields.description?.trim() ? input.fields.description.trim() : null;
  }
  if (input.fields.allowOthersToModify !== undefined) {
    if (!previous.requesterIsCreator) {
      throw new RepositoryError(
        "只有會議建立者可以變更權限設定。",
        403,
        "FORBIDDEN"
      );
    }
    patch.allow_others_to_modify = Boolean(input.fields.allowOthersToModify);
  }

  if (Object.keys(patch).length === 0) {
    return { previous, next: previous, timeChanged: false };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", previous.eventId);
  assertNoError(error, "更新活動失敗。");

  const next = await loadMutableEventForUser(input.eventId, input.requesterLineUserId);
  return { previous, next, timeChanged };
}

