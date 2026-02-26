-- Add persistent meeting prep fields to people
ALTER TABLE people ADD COLUMN IF NOT EXISTS next_meeting_at TIMESTAMPTZ;
ALTER TABLE people ADD COLUMN IF NOT EXISTS prep_notes TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS talking_points JSONB DEFAULT '[]';
