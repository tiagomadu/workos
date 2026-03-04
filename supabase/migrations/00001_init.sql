-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────
-- Tables
-- ──────────────────────────────────────────────────

-- People
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT,
    role_title TEXT,
    team_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    lead_id UUID REFERENCES people(id),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key for people.team_id after teams table exists
ALTER TABLE people ADD CONSTRAINT fk_people_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'blocked', 'complete', 'archived')),
    team_id UUID REFERENCES teams(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meetings
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    meeting_date TIMESTAMPTZ,
    meeting_type TEXT CHECK (meeting_type IN ('one_on_one', 'team_huddle', 'project_review', 'business_partner', 'other')),
    meeting_type_confidence REAL,
    transcript_path TEXT,
    transcript_text TEXT,
    summary JSONB,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
    processing_step TEXT,
    project_id UUID REFERENCES projects(id),
    calendar_event_id UUID,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Action Items (Tasks)
CREATE TABLE IF NOT EXISTS action_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    meeting_id UUID REFERENCES meetings(id),
    description TEXT NOT NULL,
    owner_name TEXT,
    owner_id UUID REFERENCES people(id),
    owner_status TEXT DEFAULT 'resolved' CHECK (owner_status IN ('resolved', 'ambiguous', 'unresolved')),
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete', 'cancelled')),
    project_id UUID REFERENCES projects(id),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document Embeddings (for RAG)
CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    meeting_id UUID NOT NULL REFERENCES meetings(id),
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    google_event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    attendees JSONB DEFAULT '[]',
    description TEXT,
    meeting_id UUID REFERENCES meetings(id),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────

CREATE INDEX idx_people_user ON people(user_id);
CREATE INDEX idx_people_team ON people(team_id);
CREATE INDEX idx_teams_user ON teams(user_id);
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(user_id, status);
CREATE INDEX idx_meetings_user ON meetings(user_id);
CREATE INDEX idx_meetings_date ON meetings(user_id, meeting_date DESC);
CREATE INDEX idx_meetings_status ON meetings(user_id, status);
CREATE INDEX idx_meetings_project ON meetings(project_id);
CREATE INDEX idx_action_items_user ON action_items(user_id);
CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX idx_action_items_owner ON action_items(owner_id);
CREATE INDEX idx_action_items_status ON action_items(user_id, status);
CREATE INDEX idx_action_items_due ON action_items(user_id, due_date);
CREATE INDEX idx_action_items_project ON action_items(project_id);
CREATE INDEX idx_document_embeddings_meeting ON document_embeddings(meeting_id);
CREATE INDEX idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_google ON calendar_events(google_event_id);
CREATE INDEX idx_calendar_events_time ON calendar_events(user_id, start_time);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- HNSW index for vector similarity search
CREATE INDEX idx_embeddings_vector ON document_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ──────────────────────────────────────────────────
-- Triggers for updated_at
-- ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_people_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_action_items_updated_at BEFORE UPDATE ON action_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────
-- Row Level Security
-- ──────────────────────────────────────────────────

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: each table scoped to auth.uid()
CREATE POLICY people_policy ON people FOR ALL USING (user_id = auth.uid());
CREATE POLICY teams_policy ON teams FOR ALL USING (user_id = auth.uid());
CREATE POLICY projects_policy ON projects FOR ALL USING (user_id = auth.uid());
CREATE POLICY meetings_policy ON meetings FOR ALL USING (user_id = auth.uid());
CREATE POLICY action_items_policy ON action_items FOR ALL USING (user_id = auth.uid());
CREATE POLICY document_embeddings_policy ON document_embeddings FOR ALL USING (user_id = auth.uid());
CREATE POLICY calendar_events_policy ON calendar_events FOR ALL USING (user_id = auth.uid());
CREATE POLICY activity_log_policy ON activity_log FOR ALL USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────
-- Similarity search function
-- ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
    id UUID,
    meeting_id UUID,
    chunk_text TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        de.id,
        de.meeting_id,
        de.chunk_text,
        1 - (de.embedding <=> query_embedding) AS similarity
    FROM document_embeddings de
    WHERE de.user_id = filter_user_id
        AND 1 - (de.embedding <=> query_embedding) > match_threshold
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
