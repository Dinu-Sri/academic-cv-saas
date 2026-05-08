-- Keep Publications as the final academic section, immediately before Declaration.
-- MySQL DDL autocommits; this migration uses idempotent UPDATE statements only.

UPDATE template_sections d
JOIN template_sections p ON p.template_id = d.template_id AND p.section_key = 'publications'
SET p.section_order = 990,
    d.section_order = 1000
WHERE d.section_key = 'declaration';

UPDATE template_sections p
LEFT JOIN template_sections d ON d.template_id = p.template_id AND d.section_key = 'declaration'
SET p.section_order = CASE WHEN d.id IS NULL THEN 1000 ELSE 990 END
WHERE p.section_key = 'publications';

UPDATE cv_sections d
JOIN cv_profiles cp ON cp.id = d.profile_id
JOIN cv_sections p ON p.profile_id = d.profile_id AND p.section_key = 'publications'
SET p.section_order = 990,
    d.section_order = 1000
WHERE d.section_key = 'declaration';

UPDATE cv_sections p
LEFT JOIN cv_sections d ON d.profile_id = p.profile_id AND d.section_key = 'declaration'
SET p.section_order = CASE WHEN d.id IS NULL THEN 1000 ELSE 990 END
WHERE p.section_key = 'publications';