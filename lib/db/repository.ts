import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/db/client";

type ChatGroupRow = {
  id: number;
  line_group_id: string;
  name: string | null;
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
    .select("id, line_group_id, name")
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

export async function ensureChatGroup(
  lineGroupId: string,
  name?: string | null
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const trimmedLineGroupId = requireNonEmpty(lineGroupId, "groupId");
  const trimmedName = normalizeOptionalText(name);
  const existing = await getChatGroupByLineGroupId(trimmedLineGroupId);

  if (existing) {
    if (trimmedName && trimmedName !== existing.name) {
      const { error } = await supabase
        .from("chat_groups")
        .update({ name: trimmedName })
        .eq("id", existing.id);
      assertNoError(error, "更新群組資料失敗。");
    }
    return;
  }

  const insertPayload: { line_group_id: string; name?: string | null } = {
    line_group_id: trimmedLineGroupId,
  };
  if (trimmedName) insertPayload.name = trimmedName;

  const { error } = await supabase.from("chat_groups").insert(insertPayload);
  assertNoError(error, "建立群組資料失敗。");
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
  await ensureChatGroup(lineGroupId);

  const group = await getChatGroupByLineGroupId(lineGroupId);
  if (!group) {
    throw new RepositoryError("群組資料不存在。", 404, "GROUP_NOT_FOUND");
  }

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
