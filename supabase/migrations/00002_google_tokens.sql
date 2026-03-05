-- Google API Token Storage
CREATE TABLE IF NOT EXISTS user_google_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_user_google_tokens_updated_at
    BEFORE UPDATE ON user_google_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_google_tokens_policy ON user_google_tokens
    FOR ALL USING (user_id = auth.uid());
