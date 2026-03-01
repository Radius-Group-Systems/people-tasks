-- Create a default organization and assign all existing data to it

-- Insert default org with a fixed UUID so we can reference it
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default');

-- Assign all existing data to the default org
UPDATE people SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE encounters SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE encounter_folders SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE action_items SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE delegation_chains SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE embeddings SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE calendar_events SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE settings SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE projects SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE milestones SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
