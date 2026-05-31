ALTER TABLE line_users
  ADD COLUMN IF NOT EXISTS google_display_name TEXT;
