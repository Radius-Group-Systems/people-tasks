-- Add checklist (subtasks) to action items
ALTER TABLE action_items ADD COLUMN checklist JSONB DEFAULT '[]';
