-- Google OAuth state (one-time) + refresh tokens + meeting summaries

CREATE TABLE IF NOT EXISTS google_oauth_states (
  state TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES line_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS google_oauth_states_user_id_idx
  ON google_oauth_states(user_id);

CREATE INDEX IF NOT EXISTS google_oauth_states_expires_at_idx
  ON google_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS google_credentials (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES line_users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  scopes TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS google_credentials_set_updated_at ON google_credentials;
CREATE TRIGGER google_credentials_set_updated_at
  BEFORE UPDATE ON google_credentials
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS event_summaries (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES chat_groups(id) ON DELETE RESTRICT,
  requested_by_user_id BIGINT NOT NULL REFERENCES line_users(id) ON DELETE RESTRICT,
  source_drive_url TEXT NOT NULL,
  source_drive_file_id TEXT NOT NULL,
  transcript_text TEXT,
  summary_json JSONB,
  summary_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  qstash_message_id TEXT,
  processing_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_summaries_status_check CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS event_summaries_group_id_idx
  ON event_summaries(group_id);

CREATE INDEX IF NOT EXISTS event_summaries_status_idx
  ON event_summaries(status);

DROP TRIGGER IF EXISTS event_summaries_set_updated_at ON event_summaries;
CREATE TRIGGER event_summaries_set_updated_at
  BEFORE UPDATE ON event_summaries
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

