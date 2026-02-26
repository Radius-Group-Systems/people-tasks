-- Add links and attachments to action items
ALTER TABLE action_items ADD COLUMN links JSONB DEFAULT '[]';
ALTER TABLE action_items ADD COLUMN attachments JSONB DEFAULT '[]';
