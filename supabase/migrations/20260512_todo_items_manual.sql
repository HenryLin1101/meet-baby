-- Allow manually-created todo items (no summary)
ALTER TABLE todo_items
  ALTER COLUMN summary_id DROP NOT NULL;
