-- Junction table for multiple assignees per todo item
CREATE TABLE IF NOT EXISTS todo_item_assignees (
  id          BIGSERIAL PRIMARY KEY,
  todo_id     BIGINT NOT NULL REFERENCES todo_items(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES line_users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(todo_id, user_id)
);

CREATE INDEX IF NOT EXISTS todo_item_assignees_todo_id_idx
  ON todo_item_assignees(todo_id);

-- Migrate existing single-assignee data
INSERT INTO todo_item_assignees (todo_id, user_id)
SELECT id, assigned_user_id
FROM todo_items
WHERE assigned_user_id IS NOT NULL
  AND deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Drop the old single-assignee column
ALTER TABLE todo_items DROP COLUMN IF EXISTS assigned_user_id;
