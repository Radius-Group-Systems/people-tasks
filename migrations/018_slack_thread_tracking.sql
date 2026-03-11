-- Track which Slack thread an action item originated from
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS slack_channel_id TEXT;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT;
