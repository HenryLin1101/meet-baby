-- Per-meeting toggle: creator decides whether other group members may
-- edit / cancel the event. Default TRUE preserves the existing
-- "any active group member can mutate" behaviour for rows created
-- before this migration runs.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS allow_others_to_modify BOOLEAN NOT NULL DEFAULT TRUE;
