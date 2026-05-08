-- Keep the academic closing order as Publications, References, then Declaration.
-- MySQL DDL autocommits; this migration uses idempotent UPDATE statements only.

UPDATE template_sections
SET section_order = CASE section_key
    WHEN 'publications' THEN 980
    WHEN 'references' THEN 990
    WHEN 'declaration' THEN 1000
    ELSE section_order
END
WHERE section_key IN ('publications', 'references', 'declaration');

UPDATE cv_sections
SET section_order = CASE section_key
    WHEN 'publications' THEN 980
    WHEN 'references' THEN 990
    WHEN 'declaration' THEN 1000
    ELSE section_order
END
WHERE section_key IN ('publications', 'references', 'declaration');