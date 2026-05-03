-- Migration 035: Update language proficiency dropdown labels to professional academic terms
--
-- Replaces "Basic" → "Elementary", "Intermediate (Average)" → "Intermediate",
-- "Fluent" → "Proficient" in all template_sections where section_key = 'languages'.

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
                JSON_OBJECT('value','basic','label','Elementary'),
                JSON_OBJECT('value','intermediate','label','Intermediate'),
                JSON_OBJECT('value','fluent','label','Proficient'),
                JSON_OBJECT('value','native','label','Native')
            )
        )
   )
 WHERE section_key = 'languages';
