-- Migration 034: Languages proficiency dropdown + Declaration section
--
-- Goals:
-- 1) Convert languages.proficiency to a controlled dropdown in all templates
--    with default "Intermediate".
-- 2) Add a new final Declaration section to all active templates.
-- 3) Backfill cv_sections for existing CVs and seed one default declaration entry.

-- 1) Languages section schema: dropdown proficiency with default "Intermediate"
UPDATE template_sections
   SET fields_schema = JSON_ARRAY(
        JSON_OBJECT(
            'name','language',
            'label','Language',
            'type','text',
            'required',true,
            'placeholder','English'
        ),
        JSON_OBJECT(
            'name','proficiency',
            'label','Proficiency',
            'type','select',
            'required',true,
            'default','intermediate',
            'options',JSON_ARRAY(
                JSON_OBJECT('value','basic','label','Basic'),
                JSON_OBJECT('value','intermediate','label','Intermediate (Average)'),
                JSON_OBJECT('value','fluent','label','Fluent'),
                JSON_OBJECT('value','native','label','Native / Bilingual')
            )
        )
   )
 WHERE section_key = 'languages';

-- 2) Add Declaration section at the end for each active template
INSERT IGNORE INTO template_sections
    (template_id, section_key, display_name, section_order, is_required, is_repeatable, fields_schema, latex_code)
SELECT
    t.id,
    'declaration',
    'Declaration',
    COALESCE((SELECT MAX(ts.section_order) + 1 FROM template_sections ts WHERE ts.template_id = t.id), 1),
    0,
    0,
    JSON_ARRAY(
        JSON_OBJECT(
            'name','statement',
            'label','Declaration Statement',
            'type','textarea',
            'required',true,
            'default','I hereby declare that the information provided above is true and accurate to the best of my knowledge.'
        ),
        JSON_OBJECT(
            'name','declaration_date',
            'label','Date',
            'type','date'
        ),
        JSON_OBJECT(
            'name','signature_mode',
            'label','Signature Type',
            'type','select',
            'required',true,
            'default','manual',
            'options',JSON_ARRAY(
                JSON_OBJECT('value','manual','label','Manual Signature (with signing space)'),
                JSON_OBJECT('value','electronic','label','Electronic Signature')
            )
        ),
        JSON_OBJECT(
            'name','signature_name',
            'label','Signatory Name',
            'type','text',
            'placeholder','Type your full name (used for electronic signature)'
        )
    ),
    ''
FROM templates t
WHERE t.is_active = 1;

-- Keep declaration as the last section in every template
UPDATE template_sections d
JOIN (
    SELECT template_id, COALESCE(MAX(section_order), 0) AS max_order
    FROM template_sections
    WHERE section_key <> 'declaration'
    GROUP BY template_id
) m ON m.template_id = d.template_id
SET d.section_order = m.max_order + 1
WHERE d.section_key = 'declaration';

-- 3) Add declaration cv_sections to existing CVs (new CVs are handled at editor load)
INSERT IGNORE INTO cv_sections (profile_id, section_key, section_order, is_visible)
SELECT
    cp.id,
    'declaration',
    COALESCE((SELECT MAX(cs2.section_order) + 1 FROM cv_sections cs2 WHERE cs2.profile_id = cp.id), 1),
    1
FROM cv_profiles cp;

-- Align declaration cv_sections order to their template order
UPDATE cv_sections cs
JOIN cv_profiles cp ON cp.id = cs.profile_id
JOIN template_sections ts ON ts.template_id = cp.template_id AND ts.section_key = cs.section_key
SET cs.section_order = ts.section_order
WHERE cs.section_key = 'declaration';

-- Seed one declaration entry for existing CVs if none exists
INSERT INTO cv_entries (section_id, entry_order, data)
SELECT
    cs.id,
    0,
    JSON_OBJECT(
        'statement','I hereby declare that the information provided above is true and accurate to the best of my knowledge.',
        'declaration_date', DATE_FORMAT(CURDATE(), '%Y-%m-%d'),
        'signature_mode','manual',
        'signature_name',''
    )
FROM cv_sections cs
LEFT JOIN cv_entries ce ON ce.section_id = cs.id
WHERE cs.section_key = 'declaration'
GROUP BY cs.id
HAVING COUNT(ce.id) = 0;
