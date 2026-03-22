-- Migration 008: Shared profile entries system
-- User-level master data that auto-populates new CVs

-- Add personal_info JSON to users table (master copy)
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_info JSON DEFAULT NULL AFTER affiliation;

-- Create user_entries table (master copy of all entries)
CREATE TABLE IF NOT EXISTS user_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    section_key VARCHAR(100) NOT NULL,
    entry_order INT DEFAULT 0,
    data JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_section (user_id, section_key)
) ENGINE=InnoDB;

-- Link cv_entries back to their master user_entry
ALTER TABLE cv_entries ADD COLUMN IF NOT EXISTS user_entry_id INT NULL AFTER section_id;
ALTER TABLE cv_entries ADD INDEX IF NOT EXISTS idx_user_entry (user_entry_id);

-- Backfill: Copy existing CV data into user_entries for each user
-- For each user, take entries from their most recently updated CV
INSERT INTO user_entries (user_id, section_key, entry_order, data, created_at, updated_at)
SELECT u.id, cs.section_key, ce.entry_order, ce.data, ce.created_at, ce.updated_at
FROM cv_entries ce
JOIN cv_sections cs ON ce.section_id = cs.id
JOIN cv_profiles cp ON cs.profile_id = cp.id
JOIN users u ON cp.user_id = u.id
WHERE cp.id = (
    SELECT cp2.id FROM cv_profiles cp2 
    WHERE cp2.user_id = u.id 
    ORDER BY cp2.updated_at DESC 
    LIMIT 1
)
ORDER BY u.id, cs.section_key, ce.entry_order;

-- Backfill: Copy personal_info from most recent CV to users table
UPDATE users u
JOIN cv_profiles cp ON cp.user_id = u.id
SET u.personal_info = cp.personal_info
WHERE cp.id = (
    SELECT cp2.id FROM cv_profiles cp2 
    WHERE cp2.user_id = u.id 
    AND cp2.personal_info IS NOT NULL 
    AND cp2.personal_info != 'null'
    AND cp2.personal_info != '{}'
    ORDER BY cp2.updated_at DESC 
    LIMIT 1
);

-- Link existing cv_entries to their user_entries where data matches
UPDATE cv_entries ce
JOIN cv_sections cs ON ce.section_id = cs.id
JOIN cv_profiles cp ON cs.profile_id = cp.id
JOIN user_entries ue ON ue.user_id = cp.user_id 
    AND ue.section_key = cs.section_key 
    AND ue.data = ce.data
SET ce.user_entry_id = ue.id
WHERE ce.user_entry_id IS NULL;
