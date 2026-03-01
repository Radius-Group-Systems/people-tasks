-- SMS notifications: phone verification fields on users, notification dedup log

ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN phone_verification_code TEXT;
ALTER TABLE users ADD COLUMN phone_verification_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN sms_notifications_enabled BOOLEAN DEFAULT false;

CREATE TABLE notification_log (
  id SERIAL PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action_item_id INT REFERENCES action_items(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,  -- 'due_reminder', 'overdue', 'follow_up'
  channel TEXT NOT NULL DEFAULT 'sms',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_log_dedup ON notification_log (user_id, action_item_id, notification_type);
