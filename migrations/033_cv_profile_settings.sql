-- Migration 033: per-CV settings (e.g. custom heading color)
-- Adds cv_settings JSON column to cv_profiles so each CV can override
-- template defaults (primaryColor, etc.) independently.

SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cv_profiles'
      AND COLUMN_NAME = 'cv_settings'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE cv_profiles ADD COLUMN cv_settings JSON DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
