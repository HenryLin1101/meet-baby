CREATE TABLE IF NOT EXISTS todo_items (
  id                   BIGSERIAL PRIMARY KEY,
  summary_id           BIGINT NOT NULL REFERENCES event_summaries(id) ON DELETE CASCADE,
  group_id             BIGINT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  item                 TEXT NOT NULL,
  owner                TEXT NOT NULL DEFAULT '',
  assigned_user_id     BIGINT REFERENCES line_users(id) ON DELETE SET NULL,
  due                  TEXT NOT NULL DEFAULT '',
  is_completed         BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by_user_id BIGINT REFERENCES line_users(id) ON DELETE SET NULL,
  completed_at         TIMESTAMPTZ,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS todo_items_group_id_idx
  ON todo_items(group_id);

CREATE INDEX IF NOT EXISTS todo_items_summary_id_idx
  ON todo_items(summary_id);

CREATE INDEX IF NOT EXISTS todo_items_group_active_idx
  ON todo_items(group_id, deleted_at)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS todo_items_set_updated_at ON todo_items;
CREATE TRIGGER todo_items_set_updated_at
  BEFORE UPDATE ON todo_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
