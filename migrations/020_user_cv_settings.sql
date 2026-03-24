-- Migration 020: Add CV settings column to users table
-- Stores user-level PDF generation preferences (page size, margins, font, etc.)

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'cv_settings');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN cv_settings JSON DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
