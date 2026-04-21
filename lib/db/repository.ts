import type { PoolClient, QueryResultRow } from "pg";
import { withDb } from "@/lib/db/client";

type ChatGroupRow = {
  id: number;
  lineGroupId: string;
  name: string | null;
};

type LineUserRow = {
  id: number;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  statusMessage: string | null;
  languageCode: string | null;
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
  userId: number | string;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
};

type EventAttendeeRow = {
  userId: number | string;
  displayName: string;
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

function toChatGroup(row: QueryResultRow): ChatGroupRow {
  return {
    id: Number(row.id),
    lineGroupId: String(row.lineGroupId),
    name: row.name === null ? null : String(row.name),
  };
}

function toLineUser(row: QueryResultRow): LineUserRow {
  return {
    id: Number(row.id),
    lineUserId: String(row.lineUserId),
    displayName: String(row.displayName),
    pictureUrl: row.pictureUrl === null ? null : String(row.pictureUrl),
    statusMessage:
      row.statusMessage === null ? null : String(row.statusMessage),
    languageCode:
      row.languageCode === null ? null : String(row.languageCode),
    email: row.email === null ? null : String(row.email),
  };
}

async function ensureChatGroupWithClient(
  client: PoolClient,
  lineGroupId: string,
  name?: string | null
): Promise<ChatGroupRow> {
  const result = await client.query(
    `
      INSERT INTO chat_groups (line_group_id, name)
      VALUES ($1, $2)
      ON CONFLICT (line_group_id)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, chat_groups.name)
      RETURNING
        id,
        line_group_id AS "lineGroupId",
        name
    `,
    [requireNonEmpty(lineGroupId, "groupId"), normalizeOptionalText(name)]
  );

  return toChatGroup(result.rows[0]);
}

async function upsertLineUserWithClient(
  client: PoolClient,
  input: LineUserProfileInput
): Promise<LineUserRow> {
  const result = await client.query(
    `
      INSERT INTO line_users (
        line_user_id,
        display_name,
        picture_url,
        status_message,
        language_code,
        email
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (line_user_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        picture_url = COALESCE(EXCLUDED.picture_url, line_users.picture_url),
        status_message = COALESCE(EXCLUDED.status_message, line_users.status_message),
        language_code = COALESCE(EXCLUDED.language_code, line_users.language_code),
        email = COALESCE(EXCLUDED.email, line_users.email)
      RETURNING
        id,
        line_user_id AS "lineUserId",
        display_name AS "displayName",
        picture_url AS "pictureUrl",
        status_message AS "statusMessage",
        language_code AS "languageCode",
        email
    `,
    [
      requireNonEmpty(input.lineUserId, "lineUserId"),
      requireNonEmpty(input.displayName, "displayName"),
      normalizeOptionalText(input.pictureUrl),
      normalizeOptionalText(input.statusMessage),
      normalizeOptionalText(input.languageCode),
      normalizeOptionalText(input.email),
    ]
  );

  return toLineUser(result.rows[0]);
}

async function getChatGroupByLineGroupId(
  client: PoolClient,
  lineGroupId: string
): Promise<ChatGroupRow | null> {
  const result = await client.query(
    `
      SELECT
        id,
        line_group_id AS "lineGroupId",
        name
      FROM chat_groups
      WHERE line_group_id = $1
      LIMIT 1
    `,
    [lineGroupId]
  );

  return result.rows[0] ? toChatGroup(result.rows[0]) : null;
}

async function getLineUserByLineUserId(
  client: PoolClient,
  lineUserId: string
): Promise<LineUserRow | null> {
  const result = await client.query(
    `
      SELECT
        id,
        line_user_id AS "lineUserId",
        display_name AS "displayName",
        picture_url AS "pictureUrl",
        status_message AS "statusMessage",
        language_code AS "languageCode",
        email
      FROM line_users
      WHERE line_user_id = $1
      LIMIT 1
    `,
    [lineUserId]
  );

  return result.rows[0] ? toLineUser(result.rows[0]) : null;
}

async function assertActiveMembership(
  client: PoolClient,
  groupId: number,
  userId: number,
  label: string
): Promise<void> {
  const result = await client.query(
    `
      SELECT 1
      FROM group_memberships
      WHERE group_id = $1
        AND user_id = $2
        AND is_active = TRUE
      LIMIT 1
    `,
    [groupId, userId]
  );

  if (result.rowCount === 0) {
    throw new RepositoryError(`${label} 不在群組名單內。`, 403, "FORBIDDEN");
  }
}

export async function ensureChatGroup(
  lineGroupId: string,
  name?: string | null
): Promise<void> {
  await withDb((client) => ensureChatGroupWithClient(client, lineGroupId, name));
}

export async function upsertLineUser(
  input: LineUserProfileInput
): Promise<void> {
  await withDb((client) => upsertLineUserWithClient(client, input));
}

export async function upsertGroupMembership(
  lineGroupId: string,
  lineUserId: string
): Promise<void> {
  await withDb(async (client) => {
    const group = await ensureChatGroupWithClient(client, lineGroupId);
    const user = await getLineUserByLineUserId(client, lineUserId);

    if (!user) {
      throw new RepositoryError(
        "找不到對應的 LINE 使用者資料。",
        404,
        "USER_NOT_FOUND"
      );
    }

    await client.query(
      `
        INSERT INTO group_memberships (group_id, user_id, joined_at, left_at, is_active)
        VALUES ($1, $2, NOW(), NULL, TRUE)
        ON CONFLICT (group_id, user_id)
        DO UPDATE SET
          is_active = TRUE,
          left_at = NULL
      `,
      [group.id, user.id]
    );
  });
}

export async function listActiveGroupMembers(
  lineGroupId: string
): Promise<GroupMember[]> {
  return withDb(async (client) => {
    const group = await getChatGroupByLineGroupId(client, lineGroupId);
    if (!group) {
      throw new RepositoryError("群組資料不存在。", 404, "GROUP_NOT_FOUND");
    }

    const result = await client.query<GroupMemberRow>(
      `
        SELECT
          u.id AS "userId",
          u.line_user_id AS "lineUserId",
          u.display_name AS "displayName",
          u.picture_url AS "pictureUrl"
        FROM group_memberships gm
        INNER JOIN line_users u ON u.id = gm.user_id
        WHERE gm.group_id = $1
          AND gm.is_active = TRUE
        ORDER BY u.display_name ASC, u.id ASC
      `,
      [group.id]
    );

    return result.rows.map((row: GroupMemberRow) => ({
      userId: Number(row.userId),
      lineUserId: String(row.lineUserId),
      displayName: String(row.displayName),
      pictureUrl: row.pictureUrl === null ? null : String(row.pictureUrl),
    }));
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

  return withDb(async (client) => {
    await client.query("BEGIN");
    try {
      const group = await getChatGroupByLineGroupId(client, lineGroupId);
      if (!group) {
        throw new RepositoryError("群組資料不存在。", 404, "GROUP_NOT_FOUND");
      }

      const creator = await getLineUserByLineUserId(client, createdByLineUserId);
      if (!creator) {
        throw new RepositoryError("建立者尚未同步到資料庫。", 404, "USER_NOT_FOUND");
      }

      await assertActiveMembership(client, group.id, creator.id, "建立者");

      const attendeeResult = await client.query<EventAttendeeRow>(
        `
          SELECT
            u.id AS "userId",
            u.display_name AS "displayName"
          FROM group_memberships gm
          INNER JOIN line_users u ON u.id = gm.user_id
          WHERE gm.group_id = $1
            AND gm.is_active = TRUE
            AND gm.user_id = ANY($2::bigint[])
        `,
        [group.id, attendeeUserIds]
      );

      if (attendeeResult.rowCount !== attendeeUserIds.length) {
        throw new RepositoryError(
          "部分參與者不在群組有效名單內。",
          400,
          "INVALID_ATTENDEES"
        );
      }

      const eventResult = await client.query(
        `
          INSERT INTO events (
            group_id,
            created_by_user_id,
            title,
            description,
            location,
            starts_at,
            ends_at,
            timezone
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id,
            title,
            description,
            location,
            starts_at AS "startsAt",
            ends_at AS "endsAt",
            timezone
        `,
        [
          group.id,
          creator.id,
          title,
          description,
          location,
          startsAt.toISOString(),
          endsAt?.toISOString() ?? null,
          timezone,
        ]
      );

      const eventRow = eventResult.rows[0];
      const eventId = Number(eventRow.id);

      await client.query(
        `
          INSERT INTO event_attendees (event_id, user_id)
          SELECT $1, UNNEST($2::bigint[])
        `,
        [eventId, attendeeUserIds]
      );

      await client.query("COMMIT");

      return {
        eventId,
        lineGroupId,
        title: String(eventRow.title),
        description:
          eventRow.description === null ? null : String(eventRow.description),
        location: eventRow.location === null ? null : String(eventRow.location),
        startsAt: new Date(String(eventRow.startsAt)).toISOString(),
        endsAt:
          eventRow.endsAt === null
            ? null
            : new Date(String(eventRow.endsAt)).toISOString(),
        timezone: String(eventRow.timezone),
        attendeeDisplayNames: attendeeResult.rows.map((row: EventAttendeeRow) =>
          String(row.displayName)
        ),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
