-- Migration 031: switch default PDF engine to xelatex
--
-- The base Docker image (Dockerfile) now bundles texlive-xetex, so xelatex is
-- available everywhere the app runs. Flip the global default; per-template
-- and circuit-breaker safeguards from migration 030 still apply, so any
-- xelatex failure transparently degrades to FPDF without user impact.
--
-- Idempotent: ON DUPLICATE KEY UPDATE so a re-run is a no-op semantically.

INSERT INTO site_settings (setting_key, setting_value)
     VALUES ('pdf_engine_default', 'latex')
ON DUPLICATE KEY UPDATE setting_value = 'latex';
