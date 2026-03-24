-- Migration 019: Add image attachment support to ticket replies
-- Each reply can have an optional image attachment

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_replies' AND COLUMN_NAME = 'attachment');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE ticket_replies ADD COLUMN attachment VARCHAR(255) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
