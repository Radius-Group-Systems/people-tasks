-- Folders for organizing encounters
CREATE TABLE IF NOT EXISTS encounter_folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  parent_id INT REFERENCES encounter_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add folder_id and notes to encounters
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS folder_id INT REFERENCES encounter_folders(id) ON DELETE SET NULL;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS notes TEXT;
