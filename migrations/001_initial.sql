-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- People you interact with
CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  slack_handle TEXT,
  organization TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Any interaction: 1:1, group meeting, email thread, etc.
CREATE TABLE encounters (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  encounter_type TEXT NOT NULL DEFAULT 'meeting',
  occurred_at TIMESTAMPTZ NOT NULL,
  summary TEXT,
  raw_transcript TEXT,
  source TEXT DEFAULT 'manual',
  source_file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: who was in the encounter
CREATE TABLE encounter_participants (
  encounter_id INT REFERENCES encounters(id) ON DELETE CASCADE,
  person_id INT REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (encounter_id, person_id)
);

-- The core unit of work
CREATE TABLE action_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  owner_type TEXT NOT NULL DEFAULT 'me',
  person_id INT REFERENCES people(id) ON DELETE SET NULL,
  source_person_id INT REFERENCES people(id) ON DELETE SET NULL,
  encounter_id INT REFERENCES encounters(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  due_at TIMESTAMPTZ,
  due_trigger TEXT,
  snoozed_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sent_via TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delegation chains
CREATE TABLE delegation_chains (
  id SERIAL PRIMARY KEY,
  action_item_id INT REFERENCES action_items(id) ON DELETE CASCADE,
  from_person_id INT REFERENCES people(id) ON DELETE SET NULL,
  to_person_id INT REFERENCES people(id) ON DELETE SET NULL,
  via_person_id INT REFERENCES people(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector embeddings for RAG
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id INT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1024),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Google Calendar events
CREATE TABLE calendar_events (
  id SERIAL PRIMARY KEY,
  google_event_id TEXT UNIQUE,
  title TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  attendees JSONB,
  encounter_id INT REFERENCES encounters(id) ON DELETE SET NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_action_items_person_status ON action_items (person_id, status);
CREATE INDEX idx_action_items_owner_status ON action_items (owner_type, status);
CREATE INDEX idx_action_items_due ON action_items (due_at) WHERE status = 'open';
CREATE INDEX idx_encounters_occurred ON encounters (occurred_at DESC);
CREATE INDEX idx_calendar_events_starts ON calendar_events (starts_at);
CREATE INDEX idx_embeddings_source ON embeddings (source_type, source_id);
