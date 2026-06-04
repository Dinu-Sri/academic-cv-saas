-- Migration 047: Website Multi-Page Mode
-- Adds optional multi-page mode to academic websites. Users can toggle between
-- single-page (default, all sections on one page) and multi-page (About,
-- Publications, Teaching, CV, Contact as separate pages with top navigation).
--
-- Idempotent: uses INFORMATION_SCHEMA checks since MySQL 8 does not support
-- ADD COLUMN IF NOT EXISTS.

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'academic_websites'
      AND COLUMN_NAME = 'site_mode');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE academic_websites ADD COLUMN site_mode ENUM(''single'',''multi'') DEFAULT ''single'' AFTER template_key',
    'SELECT ''site_mode already exists'' AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'academic_websites'
      AND COLUMN_NAME = 'nav_config');

SET @sql2 = IF(@col_exists2 = 0,
    'ALTER TABLE academic_websites ADD COLUMN nav_config JSON NULL AFTER site_mode',
    'SELECT ''nav_config already exists'' AS msg');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
