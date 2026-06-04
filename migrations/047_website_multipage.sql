-- Migration 047: Website Multi-Page Mode
-- Adds optional multi-page mode to academic websites. Users can toggle between
-- single-page (default, all sections on one page) and multi-page (About,
-- Publications, Teaching, CV, Contact as separate pages with top navigation).
--
-- Idempotent: ALTER TABLE with IF NOT EXISTS / conditional checks.

ALTER TABLE academic_websites
    ADD COLUMN IF NOT EXISTS site_mode ENUM('single','multi') DEFAULT 'single' AFTER template_key,
    ADD COLUMN IF NOT EXISTS nav_config JSON NULL AFTER site_mode;
