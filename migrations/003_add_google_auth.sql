-- 003_add_google_auth.sql
-- Add Google OAuth columns to users table

ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL AFTER orcid_id;
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER google_id;
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'local' AFTER avatar_url;

-- Allow NULL password for Google-only accounts
ALTER TABLE users MODIFY hashed_password VARCHAR(255) NULL;

-- Index for fast Google ID lookups
CREATE INDEX idx_google_id ON users (google_id);
