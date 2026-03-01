-- Enforce org_id NOT NULL on all data tables

ALTER TABLE people ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE encounters ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE encounter_folders ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE action_items ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE delegation_chains ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE embeddings ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE calendar_events ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE settings ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE projects ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE milestones ALTER COLUMN org_id SET NOT NULL;

-- Update settings PK to be (key, org_id) instead of just (key)
-- Drop the old primary key and add the new composite one
ALTER TABLE settings DROP CONSTRAINT settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (key, org_id);

-- Row-Level Security policies for tenant isolation
-- These policies ensure that queries can only access rows matching the current org context

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegation_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow access only when app.current_org_id matches org_id
-- The application sets this via SET LOCAL before each query

CREATE POLICY tenant_isolation_people ON people
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_encounters ON encounters
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_encounter_folders ON encounter_folders
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_action_items ON action_items
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_delegation_chains ON delegation_chains
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_embeddings ON embeddings
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_calendar_events ON calendar_events
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_settings ON settings
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_projects ON projects
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation_milestones ON milestones
  USING (org_id::text = current_setting('app.current_org_id', true));

-- Ensure the superuser / app role bypasses RLS (the app uses set_config to set org context)
-- The policies above use current_setting which returns empty string when not set,
-- so unscoped queries (like auth queries) won't accidentally return tenant data.
