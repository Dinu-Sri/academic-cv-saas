-- Migration 010: Move References to last section in all templates

-- Template 1 (Classic): 9 sections → references becomes 9
UPDATE template_sections SET section_order = 7 WHERE template_id = 1 AND section_key = 'research_interests';
UPDATE template_sections SET section_order = 8 WHERE template_id = 1 AND section_key = 'projects';
UPDATE template_sections SET section_order = 9 WHERE template_id = 1 AND section_key = 'references';

-- Template 2 (Modern): 12 sections → references becomes 12
UPDATE template_sections SET section_order = 7 WHERE template_id = 2 AND section_key = 'research_interests';
UPDATE template_sections SET section_order = 8 WHERE template_id = 2 AND section_key = 'projects';
UPDATE template_sections SET section_order = 9 WHERE template_id = 2 AND section_key = 'certifications';
UPDATE template_sections SET section_order = 10 WHERE template_id = 2 AND section_key = 'languages';
UPDATE template_sections SET section_order = 11 WHERE template_id = 2 AND section_key = 'professional_memberships';
UPDATE template_sections SET section_order = 12 WHERE template_id = 2 AND section_key = 'references';

-- Template 3 (Detailed): 17 sections → references becomes 17
UPDATE template_sections SET section_order = 7 WHERE template_id = 3 AND section_key = 'research_interests';
UPDATE template_sections SET section_order = 8 WHERE template_id = 3 AND section_key = 'projects';
UPDATE template_sections SET section_order = 9 WHERE template_id = 3 AND section_key = 'teaching';
UPDATE template_sections SET section_order = 10 WHERE template_id = 3 AND section_key = 'supervision';
UPDATE template_sections SET section_order = 11 WHERE template_id = 3 AND section_key = 'grants';
UPDATE template_sections SET section_order = 12 WHERE template_id = 3 AND section_key = 'conferences';
UPDATE template_sections SET section_order = 13 WHERE template_id = 3 AND section_key = 'certifications';
UPDATE template_sections SET section_order = 14 WHERE template_id = 3 AND section_key = 'languages';
UPDATE template_sections SET section_order = 15 WHERE template_id = 3 AND section_key = 'professional_memberships';
UPDATE template_sections SET section_order = 16 WHERE template_id = 3 AND section_key = 'editorial';
UPDATE template_sections SET section_order = 17 WHERE template_id = 3 AND section_key = 'references';

-- Also update cv_sections order for existing CVs to match
UPDATE cv_sections cs
JOIN cv_profiles cp ON cs.profile_id = cp.id
JOIN template_sections ts ON ts.template_id = cp.template_id AND ts.section_key = cs.section_key
SET cs.section_order = ts.section_order;
