-- Migration: Improve skills field placeholders for clarity
-- Makes it clear that each entry = one category with comma-separated skills

UPDATE template_sections
SET fields_schema = '[{"name":"category","label":"Category","type":"text","required":true,"placeholder":"e.g. Programming Languages"},{"name":"skills","label":"Skills","type":"text","required":true,"placeholder":"e.g. Python, C++, MATLAB, R"}]'
WHERE section_key = 'skills';
