-- App settings (key-value store for single-user config)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email thread tracking: link imported emails to encounters
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS email_message_id TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS email_thread_id TEXT;
CREATE INDEX IF NOT EXISTS idx_encounters_email_thread ON encounters (email_thread_id) WHERE email_thread_id IS NOT NULL;
