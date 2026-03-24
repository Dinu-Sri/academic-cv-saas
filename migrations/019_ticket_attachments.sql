-- Migration 019: Add image attachment support to ticket replies
-- Each reply can have an optional image attachment

ALTER TABLE ticket_replies ADD COLUMN IF NOT EXISTS attachment VARCHAR(255) DEFAULT NULL;
