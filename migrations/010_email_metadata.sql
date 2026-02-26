-- Store email metadata (from, to, cc, attachments) as JSONB on encounters
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS email_from JSONB;      -- {name, address}
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS email_to JSONB;        -- [{name, address}]
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS email_cc JSONB;        -- [{name, address}]
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS email_attachments JSONB DEFAULT '[]'; -- [{name, content_type, size, path}]
