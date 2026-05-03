-- Migration 030: PDF engine selection + render telemetry
--
-- Adds:
--   1. site_settings rows that control the default PDF engine and whether
--      per-template overrides are honored.
--   2. pdf_render_events table for per-render telemetry (engine, duration,
--      success, fallback). Used by the admin dashboard widget and the
--      circuit-breaker logic that auto-disables LaTeX if error rate spikes.
--
-- Idempotent: INSERT IGNORE + CREATE TABLE IF NOT EXISTS.

-- =============================================
-- PART 1: Site-level engine flags
-- =============================================
-- pdf_engine_default       : 'fpdf' (safe default) | 'latex'
-- pdf_engine_template_override : '1' to honor templates.style_config.engine | '0' to force the global default
-- pdf_engine_user_override     : '1' to honor users.cv_settings.preferred_pdf_engine | '0' to ignore it
INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
    ('pdf_engine_default',           'fpdf'),
    ('pdf_engine_template_override', '1'),
    ('pdf_engine_user_override',     '0');

-- =============================================
-- PART 2: pdf_render_events (telemetry)
-- =============================================
CREATE TABLE IF NOT EXISTS pdf_render_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NULL,
    user_id INT NULL,
    engine VARCHAR(32) NOT NULL,
    primary_engine VARCHAR(32) NULL,
    fallback TINYINT(1) NOT NULL DEFAULT 0,
    success TINYINT(1) NOT NULL DEFAULT 0,
    duration_ms INT NOT NULL DEFAULT 0,
    error_message VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_created_at (created_at),
    INDEX idx_engine_created (engine, created_at),
    INDEX idx_user (user_id),
    INDEX idx_success_created (success, created_at)
) ENGINE=InnoDB;
