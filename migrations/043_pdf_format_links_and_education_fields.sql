-- Migration 043: Personal link and education schema improvements
-- Additive only: preserves existing template-specific fields.

UPDATE template_sections
   SET fields_schema = JSON_ARRAY_APPEND(
       fields_schema,
       '$',
       JSON_OBJECT(
           'name','linkedin',
           'label','LinkedIn Profile',
           'type','url',
           'placeholder','https://www.linkedin.com/in/username',
           'help_text','Paste a full LinkedIn profile URL or username. PDF will show the username but keep it clickable.'
       )
   )
 WHERE section_key = 'personal_info'
   AND JSON_SEARCH(fields_schema, 'one', 'linkedin', NULL, '$[*].name') IS NULL;

UPDATE template_sections
   SET fields_schema = JSON_ARRAY_APPEND(
       fields_schema,
       '$',
       JSON_OBJECT(
           'name','education_level',
           'label','Education Level',
           'type','select',
           'options', JSON_ARRAY('School','Certificate','Diploma','Undergraduate','Graduate','Postgraduate','Professional'),
           'help_text','Use School for secondary/high-school records, or the closest academic level.'
       )
   )
 WHERE section_key = 'education'
   AND JSON_SEARCH(fields_schema, 'one', 'education_level', NULL, '$[*].name') IS NULL;

UPDATE template_sections
   SET fields_schema = JSON_ARRAY_APPEND(
       fields_schema,
       '$',
       JSON_OBJECT(
           'name','qualification',
           'label','Qualification / School Award',
           'type','text',
           'placeholder','G.C.E. Advanced Level, High School Diploma, B.Sc. in Biology',
           'help_text','Use this when the entry is not a traditional university degree.'
       )
   )
 WHERE section_key = 'education'
   AND JSON_SEARCH(fields_schema, 'one', 'qualification', NULL, '$[*].name') IS NULL;

UPDATE template_sections
   SET fields_schema = JSON_ARRAY_APPEND(
       fields_schema,
       '$',
       JSON_OBJECT(
           'name','field_of_study',
           'label','Field / Stream',
           'type','text',
           'placeholder','Science stream, Arts stream, Computer Science'
       )
   )
 WHERE section_key = 'education'
   AND JSON_SEARCH(fields_schema, 'one', 'field_of_study', NULL, '$[*].name') IS NULL;

UPDATE template_sections
   SET fields_schema = JSON_ARRAY_APPEND(
       fields_schema,
       '$',
       JSON_OBJECT(
           'name','description',
           'label','Notes / Achievements',
           'type','textarea',
           'placeholder','Relevant subjects, awards, school achievements, thesis details, or honors.'
       )
   )
 WHERE section_key = 'education'
   AND JSON_SEARCH(fields_schema, 'one', 'description', NULL, '$[*].name') IS NULL;
