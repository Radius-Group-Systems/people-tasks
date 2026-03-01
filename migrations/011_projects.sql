-- Projects
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active, on_hold, completed, archived
  color TEXT NOT NULL DEFAULT '#3b82f6',
  start_date DATE,
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project members: who's involved and their role
CREATE TABLE project_members (
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  person_id INT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',  -- lead, member, stakeholder, client
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, person_id)
);

-- Milestones: ordered phases within a project
CREATE TABLE milestones (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming',  -- upcoming, in_progress, completed
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link tasks to projects + optional milestone
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS project_id INT REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS milestone_id INT REFERENCES milestones(id) ON DELETE SET NULL;

-- Link encounters to projects
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS project_id INT REFERENCES projects(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_project_members_person ON project_members (person_id);
CREATE INDEX idx_milestones_project ON milestones (project_id, sort_order);
CREATE INDEX idx_action_items_project ON action_items (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_encounters_project ON encounters (project_id) WHERE project_id IS NOT NULL;
