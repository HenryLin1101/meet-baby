-- PostgreSQL schema for LINE-based meeting management
--
-- Notes:
-- 1. LINE user/group identifiers are stored as external unique keys, while each
--    table keeps an internal bigserial primary key for joins and future changes.
-- 2. LIFF profile data should be treated as display-only on the client side.
--    If the server needs trusted user identity, verify an ID token or access
--    token with LINE before writing the profile into these tables.
-- 3. groupId should come from webhook events, not from LIFF context.

BEGIN;

DO $$
BEGIN
  CREATE TYPE event_status AS ENUM ('draft', 'scheduled', 'cancelled', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE attendance_status AS ENUM ('pending', 'accepted', 'declined', 'tentative', 'attended', 'absent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE webhook_source_type AS ENUM ('user', 'group', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS line_users (
  id BIGSERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  picture_url TEXT,
  status_message TEXT,
  language_code TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_groups (
  id BIGSERIAL PRIMARY KEY,
  line_group_id TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_memberships (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES line_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT group_memberships_unique_member UNIQUE (group_id, user_id),
  CONSTRAINT group_memberships_left_after_join CHECK (
    left_at IS NULL OR left_at >= joined_at
  )
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES chat_groups(id) ON DELETE RESTRICT,
  created_by_user_id BIGINT NOT NULL REFERENCES line_users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  status event_status NOT NULL DEFAULT 'scheduled',
  meeting_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_time_range_check CHECK (
    ends_at IS NULL OR ends_at > starts_at
  )
);

CREATE TABLE IF NOT EXISTS event_attendees (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES line_users(id) ON DELETE RESTRICT,
  attendance_status attendance_status NOT NULL DEFAULT 'pending',
  response_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_attendees_unique_user UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_notes (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by_user_id BIGINT NOT NULL REFERENCES line_users(id) ON DELETE RESTRICT,
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_event_logs (
  id BIGSERIAL PRIMARY KEY,
  chat_group_id BIGINT REFERENCES chat_groups(id) ON DELETE SET NULL,
  source_user_id BIGINT REFERENCES line_users(id) ON DELETE SET NULL,
  line_event_type TEXT NOT NULL,
  line_mode TEXT,
  source_type webhook_source_type NOT NULL DEFAULT 'unknown',
  source_line_group_id TEXT,
  source_line_user_id TEXT,
  event_timestamp TIMESTAMPTZ,
  raw_event JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_line_users_line_user_id
  ON line_users (line_user_id);

CREATE INDEX IF NOT EXISTS idx_chat_groups_line_group_id
  ON chat_groups (line_group_id);

CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id
  ON group_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_group_memberships_group_active
  ON group_memberships (group_id, is_active);

CREATE INDEX IF NOT EXISTS idx_events_group_id_starts_at
  ON events (group_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_events_created_by_user_id
  ON events (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id
  ON event_attendees (user_id);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id
  ON event_attendees (event_id);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id_status
  ON event_attendees (event_id, attendance_status);

CREATE INDEX IF NOT EXISTS idx_event_notes_event_id
  ON event_notes (event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_event_logs_chat_group_id_received_at
  ON webhook_event_logs (chat_group_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_event_logs_source_ids
  ON webhook_event_logs (source_line_group_id, source_line_user_id);

CREATE INDEX IF NOT EXISTS idx_webhook_event_logs_line_event_type
  ON webhook_event_logs (line_event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_event_logs_raw_event_gin
  ON webhook_event_logs
  USING GIN (raw_event);

DROP TRIGGER IF EXISTS trg_line_users_set_updated_at ON line_users;
CREATE TRIGGER trg_line_users_set_updated_at
BEFORE UPDATE ON line_users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_groups_set_updated_at ON chat_groups;
CREATE TRIGGER trg_chat_groups_set_updated_at
BEFORE UPDATE ON chat_groups
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_group_memberships_set_updated_at ON group_memberships;
CREATE TRIGGER trg_group_memberships_set_updated_at
BEFORE UPDATE ON group_memberships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_events_set_updated_at ON events;
CREATE TRIGGER trg_events_set_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_event_attendees_set_updated_at ON event_attendees;
CREATE TRIGGER trg_event_attendees_set_updated_at
BEFORE UPDATE ON event_attendees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_event_notes_set_updated_at ON event_notes;
CREATE TRIGGER trg_event_notes_set_updated_at
BEFORE UPDATE ON event_notes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
