-- Use black headings across all current and future template previews.
-- Existing per-CV primaryColor settings are ignored by LatexRenderer after this release,
-- but keeping template configs aligned prevents stale admin/template displays.

UPDATE templates
SET style_config = JSON_SET(COALESCE(style_config, JSON_OBJECT()), '$.primaryColor', '#000000')
WHERE is_active = 1;