ALTER TABLE chat_groups
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
