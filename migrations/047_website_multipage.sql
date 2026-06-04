-- Migration 047: Website Multi-Page Mode
-- Adds optional multi-page mode to academic websites. Users can toggle between
-- single-page (default, all sections on one page) and multi-page (About,
-- Publications, Teaching, CV, Contact as separate pages with top navigation).
--
-- Idempotent: uses a stored procedure with INFORMATION_SCHEMA checks since
-- MySQL 8 does not support ADD COLUMN IF NOT EXISTS.

DROP PROCEDURE IF EXISTS mig_047;

CREATE PROCEDURE mig_047()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'academic_websites'
          AND COLUMN_NAME = 'site_mode'
    ) THEN
        ALTER TABLE academic_websites
            ADD COLUMN site_mode ENUM('single','multi') DEFAULT 'single' AFTER template_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'academic_websites'
          AND COLUMN_NAME = 'nav_config'
    ) THEN
        ALTER TABLE academic_websites
            ADD COLUMN nav_config JSON NULL AFTER site_mode;
    END IF;
END;

CALL mig_047();

DROP PROCEDURE IF EXISTS mig_047;
