-- Add org_id to all data tables (nullable for now, enforced in 015)

ALTER TABLE people ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE encounters ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE encounter_folders ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE action_items ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE delegation_chains ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE embeddings ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE calendar_events ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE settings ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE milestones ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Indexes on org_id for efficient tenant-scoped queries
CREATE INDEX idx_people_org ON people (org_id);
CREATE INDEX idx_encounters_org ON encounters (org_id);
CREATE INDEX idx_encounter_folders_org ON encounter_folders (org_id);
CREATE INDEX idx_action_items_org ON action_items (org_id);
CREATE INDEX idx_delegation_chains_org ON delegation_chains (org_id);
CREATE INDEX idx_embeddings_org ON embeddings (org_id);
CREATE INDEX idx_calendar_events_org ON calendar_events (org_id);
CREATE INDEX idx_settings_org ON settings (org_id);
CREATE INDEX idx_projects_org ON projects (org_id);
CREATE INDEX idx_milestones_org ON milestones (org_id);
