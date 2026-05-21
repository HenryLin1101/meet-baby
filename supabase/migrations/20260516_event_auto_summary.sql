-- Auto summary scan scheduling (Tactiq → Drive → LLM → LINE)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS auto_summary_qstash_message_id TEXT,
  ADD COLUMN IF NOT EXISTS auto_summary_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_summary_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_summary_last_error TEXT,
  ADD COLUMN IF NOT EXISTS auto_summary_attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE event_summaries
  ADD COLUMN IF NOT EXISTS event_id BIGINT REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_summaries_event_id_idx
  ON event_summaries(event_id);

CREATE INDEX IF NOT EXISTS event_summaries_source_drive_file_id_idx
  ON event_summaries(source_drive_file_id);
