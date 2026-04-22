ALTER TABLE google_oauth_states
ADD COLUMN IF NOT EXISTS redirect_url TEXT;

