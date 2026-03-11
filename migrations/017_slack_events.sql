-- Add Slack user ID to people for direct lookup from Events API
ALTER TABLE people ADD COLUMN IF NOT EXISTS slack_id TEXT;
CREATE INDEX IF NOT EXISTS idx_people_slack_id ON people (slack_id) WHERE slack_id IS NOT NULL;

-- Track processed Slack event IDs for idempotency (Slack retries on timeout)
CREATE TABLE IF NOT EXISTS slack_processed_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
