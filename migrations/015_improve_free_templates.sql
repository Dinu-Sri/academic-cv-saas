-- =====================================================================
-- Migration 015: Improve Free Templates (Classic, Modern, Detailed)
-- Based on CVScholar_Current_3_Templates_Improvement_Guide_Revised.md
-- =====================================================================

-- =====================================================================
-- 1) PERSONAL INFO — Add google_scholar, current_title, department
-- =====================================================================

-- Template 1 (Classic): add google_scholar, current_title, department
UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','full_name','label','Full Name','type','text','required',true),
    JSON_OBJECT('name','title','label','Title','type','text','placeholder','Dr., Prof.'),
    JSON_OBJECT('name','current_title','label','Current Position','type','text','placeholder','Lecturer, PhD Candidate, Research Assistant'),
    JSON_OBJECT('name','department','label','Department','type','text','placeholder','Department of Physics'),
    JSON_OBJECT('name','affiliation','label','Institution','type','text'),
    JSON_OBJECT('name','email','label','Email','type','email','required',true),
    JSON_OBJECT('name','phone','label','Phone','type','text'),
    JSON_OBJECT('name','address','label','City, Country','type','text','placeholder','Colombo, Sri Lanka'),
    JSON_OBJECT('name','website','label','Website','type','url'),
    JSON_OBJECT('name','orcid','label','ORCID ID','type','text','placeholder','0000-0002-xxxx-xxxx'),
    JSON_OBJECT('name','google_scholar','label','Google Scholar','type','url','placeholder','Google Scholar profile URL')
) WHERE template_id = 1 AND section_key = 'personal_info';

-- Template 2 (Modern): add google_scholar, current_title, department, linkedin
UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','full_name','label','Full Name','type','text','required',true),
    JSON_OBJECT('name','title','label','Title','type','text','placeholder','Dr., Prof.'),
    JSON_OBJECT('name','current_title','label','Current Position','type','text','placeholder','Postdoctoral Researcher, Research Engineer'),
    JSON_OBJECT('name','department','label','Department','type','text'),
    JSON_OBJECT('name','affiliation','label','Institution','type','text'),
    JSON_OBJECT('name','email','label','Email','type','email','required',true),
    JSON_OBJECT('name','phone','label','Phone','type','text'),
    JSON_OBJECT('name','address','label','City, Country','type','text','placeholder','Colombo, Sri Lanka'),
    JSON_OBJECT('name','website','label','Website','type','url'),
    JSON_OBJECT('name','orcid','label','ORCID ID','type','text','placeholder','0000-0002-xxxx-xxxx'),
    JSON_OBJECT('name','google_scholar','label','Google Scholar','type','url'),
    JSON_OBJECT('name','linkedin','label','LinkedIn','type','url','placeholder','LinkedIn profile URL')
) WHERE template_id = 2 AND section_key = 'personal_info';

-- Template 3 (Detailed): add google_scholar, current_title, department
UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','full_name','label','Full Name','type','text','required',true),
    JSON_OBJECT('name','title','label','Title','type','text','placeholder','Dr., Prof.'),
    JSON_OBJECT('name','current_title','label','Current Position','type','text','placeholder','Senior Lecturer, Associate Professor'),
    JSON_OBJECT('name','department','label','Department','type','text'),
    JSON_OBJECT('name','affiliation','label','Institution','type','text'),
    JSON_OBJECT('name','email','label','Email','type','email','required',true),
    JSON_OBJECT('name','phone','label','Phone','type','text'),
    JSON_OBJECT('name','address','label','City, Country','type','text','placeholder','Colombo, Sri Lanka'),
    JSON_OBJECT('name','website','label','Website','type','url'),
    JSON_OBJECT('name','orcid','label','ORCID ID','type','text','placeholder','0000-0002-xxxx-xxxx'),
    JSON_OBJECT('name','google_scholar','label','Google Scholar','type','url')
) WHERE template_id = 3 AND section_key = 'personal_info';

-- =====================================================================
-- 2) EDUCATION — Add thesis, location, supervisor to templates 2 & 3
-- =====================================================================

-- Template 2 (Modern): add thesis, location, supervisor
UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','degree','label','Degree','type','text','required',true,'placeholder','Ph.D. in Physics'),
    JSON_OBJECT('name','institution','label','Institution','type','text','required',true),
    JSON_OBJECT('name','location','label','Location','type','text'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present or Expected 2027'),
    JSON_OBJECT('name','thesis','label','Thesis / Dissertation Title','type','text'),
    JSON_OBJECT('name','supervisor','label','Supervisor(s)','type','text'),
    JSON_OBJECT('name','gpa','label','GPA / Class / Honours','type','text')
) WHERE template_id = 2 AND section_key = 'education';

-- Template 3 (Detailed): add thesis, location, supervisor
UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','degree','label','Degree','type','text','required',true,'placeholder','Ph.D. in Physics'),
    JSON_OBJECT('name','institution','label','Institution','type','text','required',true),
    JSON_OBJECT('name','location','label','Location','type','text'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present or Expected 2027'),
    JSON_OBJECT('name','thesis','label','Thesis / Dissertation Title','type','text'),
    JSON_OBJECT('name','supervisor','label','Supervisor(s)','type','text'),
    JSON_OBJECT('name','gpa','label','GPA / Class / Honours','type','text'),
    JSON_OBJECT('name','description','label','Additional Details','type','textarea')
) WHERE template_id = 3 AND section_key = 'education';

-- Template 1 (Classic): add supervisor field
UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','degree','label','Degree','type','text','required',true,'placeholder','Ph.D. in Physics'),
    JSON_OBJECT('name','institution','label','Institution','type','text','required',true),
    JSON_OBJECT('name','location','label','Location','type','text'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present or Expected 2027'),
    JSON_OBJECT('name','thesis','label','Thesis / Dissertation Title','type','text'),
    JSON_OBJECT('name','supervisor','label','Supervisor(s)','type','text'),
    JSON_OBJECT('name','gpa','label','GPA / Class / Honours','type','text')
) WHERE template_id = 1 AND section_key = 'education';

-- =====================================================================
-- 3) PUBLICATIONS — Add type, volume/issue/pages, status to all 3
-- =====================================================================

UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','title','label','Title','type','text','required',true),
    JSON_OBJECT('name','authors','label','Authors','type','text','required',true,'placeholder','Use bold for your name e.g. **Your Name**'),
    JSON_OBJECT('name','year','label','Year','type','text','required',true),
    JSON_OBJECT('name','publication_type','label','Type','type','text','placeholder','Journal Article, Conference Paper, Book Chapter, Preprint'),
    JSON_OBJECT('name','venue','label','Journal / Conference / Publisher','type','text'),
    JSON_OBJECT('name','volume_issue_pages','label','Volume / Issue / Pages','type','text','placeholder','Vol. 12, Issue 3, pp. 45-67'),
    JSON_OBJECT('name','doi','label','DOI','type','text'),
    JSON_OBJECT('name','url','label','URL','type','url'),
    JSON_OBJECT('name','status','label','Status','type','text','placeholder','Published, Accepted, Under Review, In Press')
) WHERE template_id IN (1, 2, 3) AND section_key = 'publications';

-- =====================================================================
-- 4) EXPERIENCE — Rename to Academic Experience, add department
-- =====================================================================

UPDATE template_sections SET display_name = 'Academic Experience',
fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','position','label','Position / Role','type','text','required',true,'placeholder','Lecturer, Research Assistant, Demonstrator'),
    JSON_OBJECT('name','organization','label','Institution / Organization','type','text','required',true),
    JSON_OBJECT('name','department','label','Department / Unit','type','text'),
    JSON_OBJECT('name','location','label','Location','type','text'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present'),
    JSON_OBJECT('name','description','label','Key Responsibilities / Achievements','type','textarea')
) WHERE template_id IN (1, 3) AND section_key = 'experience';

UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','position','label','Position / Role','type','text','required',true,'placeholder','Postdoctoral Researcher, Research Engineer'),
    JSON_OBJECT('name','organization','label','Institution / Organization','type','text','required',true),
    JSON_OBJECT('name','department','label','Department / Unit','type','text'),
    JSON_OBJECT('name','location','label','Location','type','text'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present'),
    JSON_OBJECT('name','description','label','Key Responsibilities / Achievements','type','textarea')
) WHERE template_id = 2 AND section_key = 'experience';

-- =====================================================================
-- 5) AWARDS — Add level field to all 3
-- =====================================================================

UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','title','label','Award Title','type','text','required',true),
    JSON_OBJECT('name','organization','label','Awarding Body','type','text'),
    JSON_OBJECT('name','year','label','Year','type','text','required',true),
    JSON_OBJECT('name','level','label','Level / Significance','type','text','placeholder','University-level, National, International'),
    JSON_OBJECT('name','description','label','Notes','type','textarea')
) WHERE template_id IN (1, 2, 3) AND section_key = 'awards';

-- =====================================================================
-- 6) PROJECTS — Improve with collaborators, outputs for all 3
-- =====================================================================

-- Template 1: Add collaborators, outputs
UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','title','label','Project Title','type','text','required',true),
    JSON_OBJECT('name','role','label','Role','type','text','placeholder','Principal Investigator, Co-PI, Team Member'),
    JSON_OBJECT('name','organization','label','Organization / Funder','type','text'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present'),
    JSON_OBJECT('name','collaborators','label','Collaborators','type','text'),
    JSON_OBJECT('name','outputs','label','Outputs','type','text','placeholder','Paper, Report, Prototype, Software, Dataset'),
    JSON_OBJECT('name','description','label','Description','type','textarea')
) WHERE template_id = 1 AND section_key = 'projects';

-- Template 2: Add collaborators, outputs, tools
UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','title','label','Project Title','type','text','required',true),
    JSON_OBJECT('name','role','label','Role','type','text','placeholder','Principal Investigator, Co-PI, Developer'),
    JSON_OBJECT('name','organization','label','Organization / Funder','type','text'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present'),
    JSON_OBJECT('name','collaborators','label','Collaborators','type','text'),
    JSON_OBJECT('name','outputs','label','Outputs','type','text','placeholder','Paper, Report, Prototype, Software'),
    JSON_OBJECT('name','tools_methods','label','Tools / Methods','type','text','placeholder','Python, MATLAB, GIS, etc.'),
    JSON_OBJECT('name','description','label','Description','type','textarea')
) WHERE template_id = 2 AND section_key = 'projects';

-- Template 3: Already has funding fields, add collaborators, outputs
UPDATE template_sections SET display_name = 'Research Projects',
fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','title','label','Project Title','type','text','required',true),
    JSON_OBJECT('name','role','label','Role','type','text','placeholder','Principal Investigator, Co-PI'),
    JSON_OBJECT('name','funding_agency','label','Funding Agency','type','text'),
    JSON_OBJECT('name','amount','label','Funding Amount','type','text','placeholder','e.g., $50,000'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present'),
    JSON_OBJECT('name','collaborators','label','Collaborators','type','text'),
    JSON_OBJECT('name','outputs','label','Outputs','type','text','placeholder','Paper, Report, Prototype, Software'),
    JSON_OBJECT('name','description','label','Description','type','textarea')
) WHERE template_id = 3 AND section_key = 'projects';

-- =====================================================================
-- 7) RESEARCH INTERESTS — Add keywords field
-- =====================================================================

UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','area','label','Research Area','type','text','required',true,'placeholder','e.g., Machine Learning, Computational Chemistry'),
    JSON_OBJECT('name','keywords','label','Keywords','type','text','placeholder','Comma-separated keywords'),
    JSON_OBJECT('name','description','label','Brief Description','type','textarea','placeholder','Brief description of this research interest')
) WHERE template_id IN (1, 2, 3) AND section_key = 'research_interests';

-- =====================================================================
-- 8) REFERENCES — Add relationship field
-- =====================================================================

UPDATE template_sections SET fields_schema = JSON_ARRAY(
    JSON_OBJECT('name','name','label','Full Name','type','text','required',true),
    JSON_OBJECT('name','title','label','Title / Position','type','text'),
    JSON_OBJECT('name','affiliation','label','Institution','type','text'),
    JSON_OBJECT('name','relationship','label','Relationship','type','text','placeholder','PhD Supervisor, Head of Department'),
    JSON_OBJECT('name','email','label','Email','type','email'),
    JSON_OBJECT('name','phone','label','Phone','type','text')
) WHERE template_id IN (1, 2, 3) AND section_key = 'references';

-- =====================================================================
-- 9) ADD MISSING SECTIONS TO TEMPLATES
-- =====================================================================

-- === ACADEMIC PROFILE / SUMMARY === (new section for all 3)
INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, fields_schema) VALUES
(1, 'academic_profile', 'Academic Profile', 2, 0, JSON_ARRAY(
    JSON_OBJECT('name','summary','label','Academic Summary','type','textarea','placeholder','2-4 lines: your field, strengths, research direction, and academic focus.')
)),
(2, 'academic_profile', 'Professional Summary', 2, 0, JSON_ARRAY(
    JSON_OBJECT('name','summary','label','Professional Summary','type','textarea','placeholder','2-4 lines: your field, expertise, research interests, and career direction.')
)),
(3, 'academic_profile', 'Academic Profile', 2, 0, JSON_ARRAY(
    JSON_OBJECT('name','summary','label','Academic Profile','type','textarea','placeholder','2-4 lines summarizing your research focus, academic experience, and key contributions.')
));

-- === ADD CONFERENCES to Template 1 ===
INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, fields_schema) VALUES
(1, 'conferences', 'Conferences & Presentations', 10, 0, JSON_ARRAY(
    JSON_OBJECT('name','title','label','Presentation Title','type','text','required',true),
    JSON_OBJECT('name','conference','label','Conference / Event Name','type','text','required',true),
    JSON_OBJECT('name','location','label','Location','type','text'),
    JSON_OBJECT('name','year','label','Year','type','text','required',true),
    JSON_OBJECT('name','type','label','Type','type','text','placeholder','Oral, Poster, Keynote, Invited Talk')
));

-- === ADD CONFERENCES to Template 2 ===
INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, fields_schema) VALUES
(2, 'conferences', 'Conferences & Presentations', 10, 0, JSON_ARRAY(
    JSON_OBJECT('name','title','label','Presentation Title','type','text','required',true),
    JSON_OBJECT('name','conference','label','Conference / Event Name','type','text','required',true),
    JSON_OBJECT('name','location','label','Location','type','text'),
    JSON_OBJECT('name','year','label','Year','type','text','required',true),
    JSON_OBJECT('name','type','label','Type','type','text','placeholder','Oral, Poster, Keynote, Invited Talk')
));

-- === ADD CERTIFICATIONS & LANGUAGES & MEMBERSHIPS to Template 1 ===
INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, fields_schema) VALUES
(1, 'certifications', 'Certifications & Training', 11, 0, JSON_ARRAY(
    JSON_OBJECT('name','title','label','Certification / Training','type','text','required',true,'placeholder','e.g., Research Ethics, Laboratory Safety'),
    JSON_OBJECT('name','issuer','label','Issuing Organization','type','text','required',true),
    JSON_OBJECT('name','year','label','Year Obtained','type','text','required',true),
    JSON_OBJECT('name','credential_id','label','Credential ID','type','text'),
    JSON_OBJECT('name','description','label','Notes','type','textarea')
)),
(1, 'languages', 'Languages', 12, 0, JSON_ARRAY(
    JSON_OBJECT('name','language','label','Language','type','text','required',true),
    JSON_OBJECT('name','proficiency','label','Proficiency Level','type','text','required',true,'placeholder','Native, Fluent, Professional Working, Intermediate, Basic')
)),
(1, 'professional_memberships', 'Professional Memberships', 13, 0, JSON_ARRAY(
    JSON_OBJECT('name','organization','label','Organization','type','text','required',true,'placeholder','e.g., IEEE, ACM, ACS'),
    JSON_OBJECT('name','role','label','Role / Grade','type','text','placeholder','Fellow, Senior Member, Member'),
    JSON_OBJECT('name','year_start','label','Since','type','text','required',true),
    JSON_OBJECT('name','year_end','label','Until','type','text','placeholder','Present')
));

-- === ADD TEACHING to Templates 1 & 2 ===
INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, fields_schema) VALUES
(1, 'teaching', 'Teaching Experience', 14, 0, JSON_ARRAY(
    JSON_OBJECT('name','course','label','Course Title','type','text','required',true),
    JSON_OBJECT('name','code','label','Course Code','type','text'),
    JSON_OBJECT('name','level','label','Level','type','text','placeholder','Undergraduate, Postgraduate'),
    JSON_OBJECT('name','institution','label','Institution','type','text','required',true),
    JSON_OBJECT('name','role','label','Role','type','text','placeholder','Lecturer, Tutor, Demonstrator'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present'),
    JSON_OBJECT('name','description','label','Description','type','textarea')
)),
(2, 'teaching', 'Teaching Experience', 14, 0, JSON_ARRAY(
    JSON_OBJECT('name','course','label','Course Title','type','text','required',true),
    JSON_OBJECT('name','code','label','Course Code','type','text'),
    JSON_OBJECT('name','level','label','Level','type','text','placeholder','Undergraduate, Postgraduate'),
    JSON_OBJECT('name','institution','label','Institution','type','text','required',true),
    JSON_OBJECT('name','role','label','Role','type','text','placeholder','Lecturer, Tutor, Demonstrator'),
    JSON_OBJECT('name','year_start','label','Start Year','type','text','required',true),
    JSON_OBJECT('name','year_end','label','End Year','type','text','placeholder','Present'),
    JSON_OBJECT('name','description','label','Description','type','textarea')
));

-- =====================================================================
-- 10) UPDATE SECTION ORDERS PER GUIDE RECOMMENDATIONS
-- =====================================================================

-- Template 1 (Classic Academic): Traditional conservative order
UPDATE template_sections SET section_order = 1 WHERE template_id = 1 AND section_key = 'personal_info';
UPDATE template_sections SET section_order = 2 WHERE template_id = 1 AND section_key = 'academic_profile';
UPDATE template_sections SET section_order = 3 WHERE template_id = 1 AND section_key = 'education';
UPDATE template_sections SET section_order = 4 WHERE template_id = 1 AND section_key = 'experience';
UPDATE template_sections SET section_order = 5 WHERE template_id = 1 AND section_key = 'research_interests';
UPDATE template_sections SET section_order = 6 WHERE template_id = 1 AND section_key = 'publications';
UPDATE template_sections SET section_order = 7 WHERE template_id = 1 AND section_key = 'projects';
UPDATE template_sections SET section_order = 8 WHERE template_id = 1 AND section_key = 'awards';
UPDATE template_sections SET section_order = 9 WHERE template_id = 1 AND section_key = 'conferences';
UPDATE template_sections SET section_order = 10 WHERE template_id = 1 AND section_key = 'teaching';
UPDATE template_sections SET section_order = 11 WHERE template_id = 1 AND section_key = 'certifications';
UPDATE template_sections SET section_order = 12 WHERE template_id = 1 AND section_key = 'skills';
UPDATE template_sections SET section_order = 13 WHERE template_id = 1 AND section_key = 'professional_memberships';
UPDATE template_sections SET section_order = 14 WHERE template_id = 1 AND section_key = 'languages';
UPDATE template_sections SET section_order = 15 WHERE template_id = 1 AND section_key = 'references';

-- Template 2 (Modern Professional): Profile, interests, projects more prominent
UPDATE template_sections SET section_order = 1 WHERE template_id = 2 AND section_key = 'personal_info';
UPDATE template_sections SET section_order = 2 WHERE template_id = 2 AND section_key = 'academic_profile';
UPDATE template_sections SET section_order = 3 WHERE template_id = 2 AND section_key = 'research_interests';
UPDATE template_sections SET section_order = 4 WHERE template_id = 2 AND section_key = 'education';
UPDATE template_sections SET section_order = 5 WHERE template_id = 2 AND section_key = 'experience';
UPDATE template_sections SET section_order = 6 WHERE template_id = 2 AND section_key = 'projects';
UPDATE template_sections SET section_order = 7 WHERE template_id = 2 AND section_key = 'publications';
UPDATE template_sections SET section_order = 8 WHERE template_id = 2 AND section_key = 'skills';
UPDATE template_sections SET section_order = 9 WHERE template_id = 2 AND section_key = 'certifications';
UPDATE template_sections SET section_order = 10 WHERE template_id = 2 AND section_key = 'conferences';
UPDATE template_sections SET section_order = 11 WHERE template_id = 2 AND section_key = 'teaching';
UPDATE template_sections SET section_order = 12 WHERE template_id = 2 AND section_key = 'professional_memberships';
UPDATE template_sections SET section_order = 13 WHERE template_id = 2 AND section_key = 'languages';
UPDATE template_sections SET section_order = 14 WHERE template_id = 2 AND section_key = 'awards';
UPDATE template_sections SET section_order = 15 WHERE template_id = 2 AND section_key = 'references';

-- Template 3 (Detailed Academic): Dense, publication-forward
UPDATE template_sections SET section_order = 1 WHERE template_id = 3 AND section_key = 'personal_info';
UPDATE template_sections SET section_order = 2 WHERE template_id = 3 AND section_key = 'academic_profile';
UPDATE template_sections SET section_order = 3 WHERE template_id = 3 AND section_key = 'education';
UPDATE template_sections SET section_order = 4 WHERE template_id = 3 AND section_key = 'experience';
UPDATE template_sections SET section_order = 5 WHERE template_id = 3 AND section_key = 'research_interests';
UPDATE template_sections SET section_order = 6 WHERE template_id = 3 AND section_key = 'publications';
UPDATE template_sections SET section_order = 7 WHERE template_id = 3 AND section_key = 'projects';
UPDATE template_sections SET section_order = 8 WHERE template_id = 3 AND section_key = 'conferences';
UPDATE template_sections SET section_order = 9 WHERE template_id = 3 AND section_key = 'awards';
UPDATE template_sections SET section_order = 10 WHERE template_id = 3 AND section_key = 'teaching';
UPDATE template_sections SET section_order = 11 WHERE template_id = 3 AND section_key = 'supervision';
UPDATE template_sections SET section_order = 12 WHERE template_id = 3 AND section_key = 'grants';
UPDATE template_sections SET section_order = 13 WHERE template_id = 3 AND section_key = 'certifications';
UPDATE template_sections SET section_order = 14 WHERE template_id = 3 AND section_key = 'skills';
UPDATE template_sections SET section_order = 15 WHERE template_id = 3 AND section_key = 'professional_memberships';
UPDATE template_sections SET section_order = 16 WHERE template_id = 3 AND section_key = 'languages';
UPDATE template_sections SET section_order = 17 WHERE template_id = 3 AND section_key = 'editorial';
UPDATE template_sections SET section_order = 18 WHERE template_id = 3 AND section_key = 'references';

-- =====================================================================
-- 11) UPDATE STYLE_CONFIG — Compact left-aligned headers for all 3
-- =====================================================================

UPDATE templates SET style_config = JSON_OBJECT(
    'primaryColor', '#003366',
    'fontFamily', 'lmodern',
    'fontSize', '11pt',
    'margins', '1in',
    'headerLayout', 'left_masthead',
    'sectionHeaderStyle', 'smallcaps_rule',
    'showPageNumbers', true,
    'showLastUpdated', true,
    'entrySpacing', 4,
    'sectionSpacing', 6,
    'ruleWeight', 0.25
) WHERE id = 1;

UPDATE templates SET style_config = JSON_OBJECT(
    'primaryColor', '#0077B5',
    'fontFamily', 'cmusans',
    'fontSize', '11pt',
    'margins', '0.75in',
    'headerLayout', 'left_masthead',
    'sectionHeaderStyle', 'bold_rule',
    'showPageNumbers', true,
    'showLastUpdated', true,
    'entrySpacing', 4,
    'sectionSpacing', 6,
    'ruleWeight', 0.2
) WHERE id = 2;

UPDATE templates SET style_config = JSON_OBJECT(
    'primaryColor', '#660000',
    'fontFamily', 'ebgaramond',
    'fontSize', '10pt',
    'margins', '0.9in',
    'headerLayout', 'left_masthead',
    'sectionHeaderStyle', 'smallcaps_rule',
    'showPageNumbers', true,
    'showLastUpdated', true,
    'entrySpacing', 3,
    'sectionSpacing', 5,
    'ruleWeight', 0.25
) WHERE id = 3;

-- =====================================================================
-- 12) UPDATE TEMPLATE DESCRIPTIONS for clarity
-- =====================================================================

UPDATE templates SET description = 'Traditional academic CV with clean serif typography, conservative layout, and structured sections. Best for students, lecturers, MPhil/PhD applicants, and university job applications.' WHERE id = 1;
UPDATE templates SET description = 'Contemporary academic template with clean sans-serif design and stronger emphasis on profile, projects, and skills. Best for postdocs, interdisciplinary researchers, and innovation applicants.' WHERE id = 2;
UPDATE templates SET description = 'Comprehensive academic CV with dense, structured layout for users with extensive publications, grants, and academic service. Best for senior academics, fellowship applicants, and research-heavy profiles.' WHERE id = 3;

-- =====================================================================
-- 13) ADD ACADEMIC PROFILE SECTION as feature flag
-- =====================================================================

INSERT IGNORE INTO features (feature_key, feature_name, description, category, value_type, is_active, sort_order) VALUES
('section_academic_profile', 'Academic Profile Section', 'Academic profile or summary section', 'sections', 'boolean', 1, 30);

INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('free', 'section_academic_profile', 1, NULL),
('pro', 'section_academic_profile', 1, NULL),
('enterprise', 'section_academic_profile', 1, NULL);

-- =====================================================================
-- 14) ENABLE NEW SECTIONS for free plan
-- =====================================================================

UPDATE plan_features SET is_enabled = 1 WHERE plan = 'free' AND feature_key IN (
    'section_conferences',
    'section_teaching',
    'section_certifications',
    'section_languages',
    'section_professional_memberships'
);
