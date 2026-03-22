-- PostgreSQL initialization script for Academic CV SaaS

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS public;

-- Grant privileges
GRANT ALL ON SCHEMA public TO cvuser;
GRANT ALL PRIVILEGES ON DATABASE cvdb TO cvuser;

-- Create initial indexes (tables will be created by Alembic migrations)
-- This is just for reference

-- Note: Actual table creation should be done via Alembic migrations
-- This script only sets up extensions and permissions

-- Create a function for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully';
END $$;
