ALTER TABLE google_oauth_states
ADD COLUMN IF NOT EXISTS summary_id BIGINT REFERENCES event_summaries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS google_oauth_states_summary_id_idx
  ON google_oauth_states(summary_id);

