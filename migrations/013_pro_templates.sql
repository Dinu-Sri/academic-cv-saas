-- Migration 013: Add 3 Pro templates + new academic sections + enhanced schemas
-- Templates: Classic Faculty CV (4), European Formal Academic CV (5), Research Dossier CV (6)
-- New sections: academic_appointments, research_experience, academic_service, invited_talks, patents
-- Enhanced: publications schema upgraded, personal_info extended for pro templates

-- =============================================
-- PART 1: Insert new premium templates
-- =============================================

INSERT IGNORE INTO templates (id, name, slug, description, latex_header, latex_footer, is_premium, is_active, style_config)
VALUES (4, 'Classic Faculty CV', 'classic-faculty',
'Classic, restrained faculty-style academic CV with left-aligned masthead, clear date column, grouped sections, and elegant serif typography. Ideal for US/UK faculty applications, postdocs, and fellowship submissions.',
'\\documentclass[10.75pt,letterpaper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=0.85in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{xcolor}

\\definecolor{headercolor}{RGB}{31,58,95}
\\definecolor{secondary}{RGB}{91,103,115}
\\titleformat{\\section}{\\normalsize\\scshape\\color{headercolor}}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{10pt}{5pt}

\\pagestyle{plain}
\\begin{document}',
'\\end{document}',
1, 1,
'{"pageSize":"Letter","primaryColor":"#1F3A5F","secondaryColor":"#5B6773","fontFamily":"cmuserif","fontSize":"10.75pt","margins":"0.85in","headerLayout":"left_masthead","sectionHeaderStyle":"smallcaps_rule","entryTitleWeight":"bold","dateAlignment":"right_column","dateColumnWidth":"24mm","showPageNumbers":true,"showLastUpdated":true,"publicationStyle":"grouped","publicationNumbering":"continuous","showReferencesByDefault":false,"nameSize":"20pt","sectionTitleSize":"11.5pt","bodyLeading":1.2,"entrySpacing":3.5,"sectionSpacing":8,"ruleWeight":0.25,"linkStyle":"plain_text"}');

INSERT IGNORE INTO templates (id, name, slug, description, latex_header, latex_footer, is_premium, is_active, style_config)
VALUES (5, 'European Formal Academic CV', 'european-formal-academic',
'Clean, formal European-style academic CV with sans-serif typography, tabular date layout, and compact structure. Supports optional personal data fields for continental European applications.',
'\\documentclass[10.25pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[margin=0.8in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{xcolor}

\\definecolor{headercolor}{RGB}{35,75,70}
\\definecolor{secondary}{RGB}{106,116,124}
\\titleformat{\\section}{\\normalsize\\bfseries\\uppercase\\color{headercolor}}{}{0em}{}
\\titlespacing*{\\section}{0pt}{10pt}{5pt}

\\pagestyle{plain}
\\begin{document}',
'\\end{document}',
1, 1,
'{"pageSize":"A4","primaryColor":"#234B46","secondaryColor":"#6A747C","fontFamily":"cmusans","fontSize":"10.25pt","margins":"0.8in","headerLayout":"formal_compact","sectionHeaderStyle":"caps_no_rule","entryTitleWeight":"bold","dateAlignment":"left_date_band","dateColumnWidth":"26mm","showPageNumbers":true,"showLastUpdated":true,"publicationStyle":"grouped","publicationNumbering":"by_group","showReferencesByDefault":true,"nameSize":"18pt","sectionTitleSize":"11pt","bodyLeading":1.18,"entrySpacing":3,"sectionSpacing":7,"ruleWeight":0.18,"linkStyle":"plain_text"}');

INSERT IGNORE INTO templates (id, name, slug, description, latex_header, latex_footer, is_premium, is_active, style_config)
VALUES (6, 'Research Dossier CV', 'research-dossier',
'Publication-heavy long-form dossier for senior academics, tenure/promotion files, and large research portfolios. Dense layout with deep publication grouping and comprehensive career documentation.',
'\\documentclass[9.75pt,letterpaper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=0.78in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{longtable}

\\definecolor{headercolor}{RGB}{68,44,90}
\\definecolor{secondary}{RGB}{94,98,112}
\\titleformat{\\section}{\\normalsize\\scshape\\bfseries\\color{headercolor}}{}{0em}{}[{\\color{headercolor}\\titlerule[0.3pt]}]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}

\\pagestyle{plain}
\\begin{document}',
'\\end{document}',
1, 1,
'{"pageSize":"Letter","primaryColor":"#442C5A","secondaryColor":"#5E6270","fontFamily":"cmuserif","fontSize":"9.75pt","margins":"0.78in","headerLayout":"left_masthead_compact","sectionHeaderStyle":"smallcaps_heavy_rule","entryTitleWeight":"bold","dateAlignment":"right_column","dateColumnWidth":"23mm","showPageNumbers":true,"showLastUpdated":true,"publicationStyle":"deep_grouped","publicationNumbering":"by_group","showReferencesByDefault":false,"nameSize":"18.5pt","sectionTitleSize":"11pt","bodyLeading":1.16,"entrySpacing":2.6,"sectionSpacing":6.5,"ruleWeight":0.3,"linkStyle":"plain_text"}');


-- =============================================
-- PART 2: Feature flags for new templates
-- =============================================

INSERT IGNORE INTO features (feature_key, feature_name, description, category, value_type, sort_order) VALUES
('template_classic_faculty', 'Classic Faculty CV', 'Access to the Classic Faculty CV premium template', 'templates', 'boolean', 13),
('template_european_formal', 'European Formal Academic CV', 'Access to the European Formal Academic CV premium template', 'templates', 'boolean', 14),
('template_research_dossier', 'Research Dossier CV', 'Access to the Research Dossier CV premium template', 'templates', 'boolean', 15);

-- Free: no access to premium templates
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('free', 'template_classic_faculty', 0),
('free', 'template_european_formal', 0),
('free', 'template_research_dossier', 0);

-- Pro: all premium templates
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('pro', 'template_classic_faculty', 1),
('pro', 'template_european_formal', 1),
('pro', 'template_research_dossier', 1);

-- Enterprise: all premium templates
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('enterprise', 'template_classic_faculty', 1),
('enterprise', 'template_european_formal', 1),
('enterprise', 'template_research_dossier', 1);


-- =============================================
-- PART 3: Feature flags for new sections
-- =============================================

INSERT IGNORE INTO features (feature_key, feature_name, description, category, value_type, sort_order) VALUES
('section_academic_appointments', 'Academic Appointments Section', 'Faculty, lecturer, and research appointments', 'sections', 'boolean', 56),
('section_research_experience', 'Research Experience Section', 'Research roles, lab positions, and fellowships', 'sections', 'boolean', 57),
('section_academic_service', 'Academic Service Section', 'Committee work, reviewing, and institutional service', 'sections', 'boolean', 58),
('section_invited_talks', 'Invited Talks Section', 'Invited lectures, keynotes, and seminar presentations', 'sections', 'boolean', 59),
('section_patents', 'Patents Section', 'Patent filings and granted patents', 'sections', 'boolean', 60);

-- Free: no access to new sections
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('free', 'section_academic_appointments', 0),
('free', 'section_research_experience', 0),
('free', 'section_academic_service', 0),
('free', 'section_invited_talks', 0),
('free', 'section_patents', 0);

-- Pro: all new sections enabled
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('pro', 'section_academic_appointments', 1),
('pro', 'section_research_experience', 1),
('pro', 'section_academic_service', 1),
('pro', 'section_invited_talks', 1),
('pro', 'section_patents', 1);

-- Enterprise: all new sections enabled
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('enterprise', 'section_academic_appointments', 1),
('enterprise', 'section_research_experience', 1),
('enterprise', 'section_academic_service', 1),
('enterprise', 'section_invited_talks', 1),
('enterprise', 'section_patents', 1);


-- =============================================
-- PART 4: Template sections for Classic Faculty CV (template_id = 4)
-- Section order: personal_info, research_interests, academic_appointments, education,
--   publications, grants, teaching, supervision, academic_service, conferences,
--   projects, awards, professional_memberships, editorial, skills, languages, references
-- =============================================

INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, is_repeatable, fields_schema, latex_code) VALUES

-- personal_info with extended fields for pro templates
(4, 'personal_info', 'Personal Information', 1, 1, 0,
 '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"title","label":"Title","type":"text","placeholder":"Dr., Prof."},{"name":"affiliation","label":"Institution","type":"text"},{"name":"current_department","label":"Department","type":"text","placeholder":"Department of Physics"},{"name":"email","label":"Email","type":"email","required":true},{"name":"phone","label":"Phone","type":"text"},{"name":"city_country","label":"City, Country","type":"text","placeholder":"Cambridge, MA, USA"},{"name":"website","label":"Website","type":"url"},{"name":"orcid","label":"ORCID ID","type":"text"},{"name":"google_scholar","label":"Google Scholar URL","type":"url"},{"name":"scopus_profile","label":"Scopus Profile URL","type":"url"}]',
 '\\begin{flushleft}\n{\\LARGE\\bfseries {{full_name}}}\\\\[3pt]\n{{title}}{{#current_department}}, {{current_department}}{{/current_department}}{{#affiliation}}, {{affiliation}}{{/affiliation}}\\\\[2pt]\n{{#city_country}}{{city_country}} | {{/city_country}}{{email}}{{#phone}} | {{phone}}{{/phone}}\\\\[1pt]\n{{#website}}{{website}}{{/website}}{{#orcid}} | ORCID: {{orcid}}{{/orcid}}{{#google_scholar}} | Scholar: {{google_scholar}}{{/google_scholar}}\n\\end{flushleft}\\vspace{6pt}'),

(4, 'research_interests', 'Research Interests', 2, 0, 1,
 '[{"name":"area","label":"Research Area","type":"text","required":true,"placeholder":"e.g., Machine Learning, Computational Chemistry"},{"name":"description","label":"Description","type":"textarea","placeholder":"Brief description of this research interest"}]',
 '\\section{Research Interests}\n{{#entries}}\n\\textbf{{{area}}}{{#description}}: {{description}}{{/description}}\n\n{{/entries}}'),

(4, 'academic_appointments', 'Academic Appointments', 3, 0, 1,
 '[{"name":"position","label":"Academic Position","type":"text","required":true,"placeholder":"Associate Professor, Postdoctoral Researcher"},{"name":"department","label":"Department / Unit","type":"text","placeholder":"Department of Physics"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"location","label":"Location","type":"text","placeholder":"City, Country"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"status","label":"Appointment Type","type":"text","placeholder":"Tenure-track, Visiting, Permanent, Adjunct"},{"name":"description","label":"Description","type":"textarea","placeholder":"Optional concise description"}]',
 '\\section{Academic Appointments}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{{{position}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#department}}{{department}}, {{/department}}{{institution}}{{#location}}, {{location}}{{/location}}\\\\\n{{#status}}\\textit{{{status}}}{{/status}}{{#description}}\\\\ {{description}}{{/description}}\n{{/entries}}\n\\end{itemize}'),

(4, 'education', 'Education', 4, 0, 1,
 '[{"name":"degree","label":"Degree","type":"text","required":true,"placeholder":"Ph.D. in Physics"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"thesis","label":"Thesis Title","type":"text"},{"name":"supervisor","label":"Supervisor","type":"text","placeholder":"Prof. Jane Doe"},{"name":"gpa","label":"GPA / Distinction","type":"text"}]',
 '\\section{Education}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{{{degree}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{institution}}{{#location}}, {{location}}{{/location}}\\\\\n{{#thesis}}\\textit{Thesis: {{thesis}}}{{/thesis}}{{#supervisor}}\\\\ Supervisor: {{supervisor}}{{/supervisor}}\n{{/entries}}\n\\end{itemize}'),

(4, 'publications', 'Publications', 5, 0, 1,
 '[{"name":"title","label":"Title","type":"text","required":true},{"name":"authors","label":"Authors","type":"textarea","required":true,"placeholder":"Full author list"},{"name":"year","label":"Year","type":"text","required":true},{"name":"type","label":"Publication Type","type":"text","placeholder":"Journal Article, Conference Paper, Book Chapter, Book, Preprint"},{"name":"peer_review_status","label":"Peer Review Status","type":"text","placeholder":"Peer-reviewed, Non-peer-reviewed"},{"name":"status","label":"Publication Status","type":"text","placeholder":"Published, In Press, Accepted, Under Review, Submitted"},{"name":"venue","label":"Journal / Conference / Publisher","type":"text"},{"name":"volume","label":"Volume","type":"text"},{"name":"issue","label":"Issue","type":"text"},{"name":"pages","label":"Pages","type":"text"},{"name":"doi","label":"DOI","type":"text"},{"name":"url","label":"URL","type":"url"},{"name":"candidate_role_note","label":"Role Note","type":"text","placeholder":"First author, Corresponding author, Equal contribution"},{"name":"is_selected","label":"Selected Publication","type":"text","placeholder":"yes / no"}]',
 '\\section{Publications}\n\\begin{enumerate}[leftmargin=*]\n{{#entries}}\n\\item {{authors}} ({{year}}). \\textit{{{title}}}. {{venue}}.{{#volume}} {{volume}}{{/volume}}{{#issue}}({{issue}}){{/issue}}{{#pages}}, {{pages}}{{/pages}}.{{#doi}} DOI: {{doi}}{{/doi}}{{#status}} [{{status}}]{{/status}}\n{{/entries}}\n\\end{enumerate}'),

(4, 'grants', 'Grants & Funding', 6, 0, 1,
 '[{"name":"title","label":"Grant Title","type":"text","required":true},{"name":"agency","label":"Funding Agency","type":"text","required":true},{"name":"amount","label":"Amount","type":"text","placeholder":"e.g., $100,000"},{"name":"role","label":"Role","type":"text","placeholder":"PI, Co-PI, Named Investigator"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"status","label":"Status","type":"text","placeholder":"Active, Completed, Pending"},{"name":"grant_number","label":"Grant Number","type":"text","placeholder":"Grant/Award reference number"}]',
 '\\section{Grants \\& Funding}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{agency}}{{#amount}} -- {{amount}}{{/amount}}{{#grant_number}} ({{grant_number}}){{/grant_number}}\\\\\n{{#role}}Role: {{role}}{{/role}}{{#status}} | {{status}}{{/status}}\n\n{{/entries}}'),

(4, 'teaching', 'Teaching Experience', 7, 0, 1,
 '[{"name":"course","label":"Course Name","type":"text","required":true,"placeholder":"e.g., Introduction to Physics"},{"name":"code","label":"Course Code","type":"text","placeholder":"e.g., PHY101"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"level","label":"Level","type":"text","placeholder":"Undergraduate, Graduate, Postgraduate"},{"name":"role","label":"Role","type":"text","placeholder":"Lecturer, Teaching Assistant, Instructor"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section{Teaching Experience}\n{{#entries}}\n\\textbf{{{course}}}{{#code}} ({{code}}){{/code}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#role}}{{role}}, {{/role}}{{institution}}{{#level}} -- {{level}}{{/level}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(4, 'supervision', 'Student Supervision', 8, 0, 1,
 '[{"name":"student_name","label":"Student Name","type":"text","required":true},{"name":"degree","label":"Degree","type":"text","required":true,"placeholder":"Ph.D., M.Sc., B.Sc."},{"name":"thesis_title","label":"Thesis Title","type":"text"},{"name":"role","label":"Your Role","type":"text","placeholder":"Main Supervisor, Co-Supervisor, Examiner"},{"name":"institution","label":"Institution","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Ongoing"},{"name":"status","label":"Status","type":"text","placeholder":"Completed, In Progress"}]',
 '\\section{Student Supervision}\n{{#entries}}\n\\textbf{{{student_name}}} ({{degree}}) \\hfill {{year_start}}--{{year_end}}\\\\\n{{#thesis_title}}\\textit{{{thesis_title}}}\\\\{{/thesis_title}}\n{{#role}}{{role}}{{/role}}{{#institution}} | {{institution}}{{/institution}}{{#status}} | {{status}}{{/status}}\n\n{{/entries}}'),

(4, 'academic_service', 'Academic Service', 9, 0, 1,
 '[{"name":"activity","label":"Service Activity","type":"text","required":true,"placeholder":"Curriculum Committee, Conference Organizer"},{"name":"role","label":"Role","type":"text","placeholder":"Chair, Member, Coordinator"},{"name":"organization","label":"Organization / Unit","type":"text","placeholder":"Faculty of Engineering / IEEE"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea","placeholder":"Optional concise description"}]',
 '\\section{Academic Service}\n{{#entries}}\n\\textbf{{{activity}}}{{#role}} -- {{role}}{{/role}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#organization}}{{organization}}{{/organization}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(4, 'conferences', 'Conference Presentations', 10, 0, 1,
 '[{"name":"title","label":"Presentation Title","type":"text","required":true},{"name":"conference","label":"Conference Name","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year","label":"Year","type":"text","required":true},{"name":"type","label":"Type","type":"text","placeholder":"Oral, Poster, Keynote, Invited Talk"}]',
 '\\section{Conference Presentations}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n{{conference}}{{#location}}, {{location}}{{/location}}{{#type}} ({{type}}){{/type}}\n\n{{/entries}}'),

(4, 'projects', 'Projects', 11, 0, 1,
 '[{"name":"title","label":"Project Title","type":"text","required":true},{"name":"role","label":"Role","type":"text","placeholder":"Principal Investigator, Co-PI, Researcher"},{"name":"organization","label":"Organization/Funder","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section{Projects}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#role}}\\textit{{{role}}}{{/role}}{{#organization}}, {{organization}}{{/organization}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(4, 'awards', 'Awards & Honors', 12, 0, 1,
 '[{"name":"title","label":"Award Title","type":"text","required":true},{"name":"organization","label":"Organization","type":"text"},{"name":"year","label":"Year","type":"text","required":true},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section{Awards \\& Honors}\n{{#entries}}\n\\textbf{{{title}}}{{#organization}} -- {{organization}}{{/organization}} \\hfill {{year}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(4, 'professional_memberships', 'Professional Memberships', 13, 0, 1,
 '[{"name":"organization","label":"Organization","type":"text","required":true,"placeholder":"e.g., IEEE, ACM, ACS"},{"name":"role","label":"Role/Grade","type":"text","placeholder":"Fellow, Senior Member, Member"},{"name":"year_start","label":"Since","type":"text","required":true},{"name":"year_end","label":"Until","type":"text","placeholder":"Present"}]',
 '\\section{Professional Memberships}\n{{#entries}}\n\\textbf{{{organization}}}{{#role}} -- {{role}}{{/role}} \\hfill {{year_start}}--{{year_end}}\n\n{{/entries}}'),

(4, 'editorial', 'Editorial & Reviewing', 14, 0, 1,
 '[{"name":"journal","label":"Journal/Conference","type":"text","required":true},{"name":"role","label":"Role","type":"text","required":true,"placeholder":"Reviewer, Associate Editor, Editorial Board Member"},{"name":"year_start","label":"Since","type":"text","required":true},{"name":"year_end","label":"Until","type":"text","placeholder":"Present"}]',
 '\\section{Editorial \\& Reviewing}\n{{#entries}}\n\\textbf{{{journal}}} \\hfill {{year_start}}--{{year_end}}\\\\\n\\textit{{{role}}}\n\n{{/entries}}'),

(4, 'skills', 'Skills', 15, 0, 1,
 '[{"name":"category","label":"Category","type":"text","required":true,"placeholder":"Programming Languages"},{"name":"skills","label":"Skills","type":"text","required":true,"placeholder":"Python, MATLAB, C++"}]',
 '\\section{Skills}\n{{#entries}}\n\\textbf{{{category}}}: {{skills}}\n\n{{/entries}}'),

(4, 'languages', 'Languages', 16, 0, 1,
 '[{"name":"language","label":"Language","type":"text","required":true},{"name":"proficiency","label":"Proficiency Level","type":"text","required":true,"placeholder":"Native, Fluent, Intermediate, Basic"}]',
 '\\section{Languages}\n{{#entries}}\n\\textbf{{{language}}}: {{proficiency}}\n\n{{/entries}}'),

(4, 'certifications', 'Certifications & Licenses', 17, 0, 1,
 '[{"name":"title","label":"Certification","type":"text","required":true,"placeholder":"e.g., AWS Solutions Architect, PMP"},{"name":"issuer","label":"Issuing Organization","type":"text","required":true},{"name":"year","label":"Year Obtained","type":"text","required":true},{"name":"expiry","label":"Expiry Year","type":"text","placeholder":"No Expiry"},{"name":"credential_id","label":"Credential ID","type":"text"}]',
 '\\section{Certifications \\& Licenses}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n\\textit{{{issuer}}}{{#credential_id}} -- ID: {{credential_id}}{{/credential_id}}\n\n{{/entries}}'),

(4, 'experience', 'Other Experience', 18, 0, 1,
 '[{"name":"position","label":"Position","type":"text","required":true},{"name":"organization","label":"Organization","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section{Other Experience}\n{{#entries}}\n\\textbf{{{position}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{organization}}{{#location}}, {{location}}{{/location}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(4, 'references', 'References', 19, 0, 1,
 '[{"name":"name","label":"Name","type":"text","required":true},{"name":"title","label":"Title","type":"text"},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email"},{"name":"phone","label":"Phone","type":"text"}]',
 '\\section{References}\n{{#entries}}\n\\textbf{{{name}}}\\\\\n{{title}}, {{affiliation}}\\\\\n{{email}}{{#phone}} | {{phone}}{{/phone}}\n\n{{/entries}}');


-- =============================================
-- PART 5: Template sections for European Formal Academic CV (template_id = 5)
-- Section order: personal_info, education, academic_appointments, research_experience,
--   publications, conferences, teaching, projects, grants, academic_service,
--   professional_memberships, languages, certifications, references
-- =============================================

INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, is_repeatable, fields_schema, latex_code) VALUES

(5, 'personal_info', 'Personal Information', 1, 1, 0,
 '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"title","label":"Title","type":"text","placeholder":"Dr., Prof."},{"name":"affiliation","label":"Institution","type":"text"},{"name":"current_department","label":"Department","type":"text","placeholder":"Department of Physics"},{"name":"email","label":"Email","type":"email","required":true},{"name":"phone","label":"Phone","type":"text"},{"name":"city_country","label":"City, Country","type":"text","placeholder":"Zurich, Switzerland"},{"name":"website","label":"Website","type":"url"},{"name":"orcid","label":"ORCID ID","type":"text"},{"name":"google_scholar","label":"Google Scholar URL","type":"url"},{"name":"nationality","label":"Nationality","type":"text","placeholder":"Optional - for European applications"},{"name":"date_of_birth","label":"Date of Birth","type":"text","placeholder":"Optional - DD/MM/YYYY"}]',
 '\\begin{flushleft}\n{\\Large\\bfseries {{full_name}}}\\\\[2pt]\n{{title}}{{#current_department}}, {{current_department}}{{/current_department}}{{#affiliation}} | {{affiliation}}{{/affiliation}}\\\\[2pt]\n{{#city_country}}{{city_country}} | {{/city_country}}{{email}}{{#phone}} | {{phone}}{{/phone}}{{#website}} | {{website}}{{/website}}\\\\[1pt]\n{{#orcid}}ORCID: {{orcid}}{{/orcid}}{{#google_scholar}} | Scholar: {{google_scholar}}{{/google_scholar}}\\\\[1pt]\n{{#nationality}}Nationality: {{nationality}}{{/nationality}}{{#date_of_birth}} | Born: {{date_of_birth}}{{/date_of_birth}}\n\\end{flushleft}\\vspace{4pt}'),

(5, 'education', 'Education', 2, 0, 1,
 '[{"name":"degree","label":"Degree","type":"text","required":true,"placeholder":"Ph.D. in Physics"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"thesis","label":"Thesis Title","type":"text"},{"name":"supervisor","label":"Supervisor","type":"text","placeholder":"Prof. Jane Doe"},{"name":"gpa","label":"Grade / Distinction","type":"text"}]',
 '\\section*{EDUCATION}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{{{degree}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{institution}}{{#location}}, {{location}}{{/location}}\\\\\n{{#thesis}}\\textit{Thesis: {{thesis}}}{{/thesis}}{{#supervisor}}\\\\ Supervisor: {{supervisor}}{{/supervisor}}\n{{/entries}}\n\\end{itemize}'),

(5, 'academic_appointments', 'Academic Appointments', 3, 0, 1,
 '[{"name":"position","label":"Academic Position","type":"text","required":true,"placeholder":"Associate Professor, Postdoctoral Researcher"},{"name":"department","label":"Department / Unit","type":"text","placeholder":"Department of Physics"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"location","label":"Location","type":"text","placeholder":"City, Country"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"status","label":"Appointment Type","type":"text","placeholder":"Tenure-track, Visiting, Permanent, Adjunct"},{"name":"description","label":"Description","type":"textarea","placeholder":"Optional concise description"}]',
 '\\section*{ACADEMIC APPOINTMENTS}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{{{position}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#department}}{{department}}, {{/department}}{{institution}}{{#location}}, {{location}}{{/location}}\n{{#description}}\\\\ {{description}}{{/description}}\n{{/entries}}\n\\end{itemize}'),

(5, 'research_experience', 'Research Experience', 4, 0, 1,
 '[{"name":"role","label":"Role","type":"text","required":true,"placeholder":"Research Fellow, Research Assistant"},{"name":"lab_or_center","label":"Lab / Center / Group","type":"text","placeholder":"Computational Materials Group"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"supervisor","label":"Supervisor / PI","type":"text","placeholder":"Prof. Jane Doe"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Research Summary","type":"textarea","placeholder":"Brief research focus, methods, responsibilities"}]',
 '\\section*{RESEARCH EXPERIENCE}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{{{role}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#lab_or_center}}{{lab_or_center}}, {{/lab_or_center}}{{institution}}\\\\\n{{#supervisor}}Supervisor: {{supervisor}}{{/supervisor}}\n{{#description}}\\\\ {{description}}{{/description}}\n{{/entries}}\n\\end{itemize}'),

(5, 'publications', 'Publications', 5, 0, 1,
 '[{"name":"title","label":"Title","type":"text","required":true},{"name":"authors","label":"Authors","type":"textarea","required":true,"placeholder":"Full author list"},{"name":"year","label":"Year","type":"text","required":true},{"name":"type","label":"Publication Type","type":"text","placeholder":"Journal Article, Conference Paper, Book Chapter, Book, Preprint"},{"name":"status","label":"Publication Status","type":"text","placeholder":"Published, In Press, Accepted, Under Review"},{"name":"venue","label":"Journal / Conference / Publisher","type":"text"},{"name":"volume","label":"Volume","type":"text"},{"name":"issue","label":"Issue","type":"text"},{"name":"pages","label":"Pages","type":"text"},{"name":"doi","label":"DOI","type":"text"},{"name":"url","label":"URL","type":"url"},{"name":"candidate_role_note","label":"Role Note","type":"text","placeholder":"First author, Corresponding author"}]',
 '\\section*{PUBLICATIONS}\n\\begin{enumerate}[leftmargin=*]\n{{#entries}}\n\\item {{authors}} ({{year}}). \\textit{{{title}}}. {{venue}}.{{#volume}} {{volume}}{{/volume}}{{#issue}}({{issue}}){{/issue}}{{#pages}}, {{pages}}{{/pages}}.{{#doi}} DOI: {{doi}}{{/doi}}{{#status}} [{{status}}]{{/status}}\n{{/entries}}\n\\end{enumerate}'),

(5, 'conferences', 'Conference Presentations', 6, 0, 1,
 '[{"name":"title","label":"Presentation Title","type":"text","required":true},{"name":"conference","label":"Conference Name","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year","label":"Year","type":"text","required":true},{"name":"type","label":"Type","type":"text","placeholder":"Oral, Poster, Keynote, Invited Talk"}]',
 '\\section*{CONFERENCE PRESENTATIONS}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n{{conference}}{{#location}}, {{location}}{{/location}}{{#type}} ({{type}}){{/type}}\n\n{{/entries}}'),

(5, 'teaching', 'Teaching Experience', 7, 0, 1,
 '[{"name":"course","label":"Course Name","type":"text","required":true,"placeholder":"e.g., Introduction to Physics"},{"name":"code","label":"Course Code","type":"text","placeholder":"e.g., PHY101"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"level","label":"Level","type":"text","placeholder":"Undergraduate, Graduate, Postgraduate"},{"name":"role","label":"Role","type":"text","placeholder":"Lecturer, Teaching Assistant, Instructor"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section*{TEACHING EXPERIENCE}\n{{#entries}}\n\\textbf{{{course}}}{{#code}} ({{code}}){{/code}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#role}}{{role}}, {{/role}}{{institution}}{{#level}} -- {{level}}{{/level}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(5, 'projects', 'Projects', 8, 0, 1,
 '[{"name":"title","label":"Project Title","type":"text","required":true},{"name":"role","label":"Role","type":"text","placeholder":"Principal Investigator, Co-PI, Researcher"},{"name":"organization","label":"Organization/Funder","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section*{PROJECTS}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#role}}\\textit{{{role}}}{{/role}}{{#organization}}, {{organization}}{{/organization}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(5, 'grants', 'Grants & Funding', 9, 0, 1,
 '[{"name":"title","label":"Grant Title","type":"text","required":true},{"name":"agency","label":"Funding Agency","type":"text","required":true},{"name":"amount","label":"Amount","type":"text","placeholder":"e.g., EUR 100,000"},{"name":"role","label":"Role","type":"text","placeholder":"PI, Co-PI, Named Investigator"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"status","label":"Status","type":"text","placeholder":"Active, Completed, Pending"}]',
 '\\section*{GRANTS \\& FUNDING}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{agency}}{{#amount}} -- {{amount}}{{/amount}}\\\\\n{{#role}}Role: {{role}}{{/role}}{{#status}} | {{status}}{{/status}}\n\n{{/entries}}'),

(5, 'academic_service', 'Academic Service', 10, 0, 1,
 '[{"name":"activity","label":"Service Activity","type":"text","required":true,"placeholder":"Curriculum Committee, Conference Organizer"},{"name":"role","label":"Role","type":"text","placeholder":"Chair, Member, Coordinator"},{"name":"organization","label":"Organization / Unit","type":"text","placeholder":"Faculty of Engineering / IEEE"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea","placeholder":"Optional concise description"}]',
 '\\section*{ACADEMIC SERVICE}\n{{#entries}}\n\\textbf{{{activity}}}{{#role}} -- {{role}}{{/role}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#organization}}{{organization}}{{/organization}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(5, 'professional_memberships', 'Professional Memberships', 11, 0, 1,
 '[{"name":"organization","label":"Organization","type":"text","required":true,"placeholder":"e.g., IEEE, ACM, ACS"},{"name":"role","label":"Role/Grade","type":"text","placeholder":"Fellow, Senior Member, Member"},{"name":"year_start","label":"Since","type":"text","required":true},{"name":"year_end","label":"Until","type":"text","placeholder":"Present"}]',
 '\\section*{PROFESSIONAL MEMBERSHIPS}\n{{#entries}}\n\\textbf{{{organization}}}{{#role}} -- {{role}}{{/role}} \\hfill {{year_start}}--{{year_end}}\n\n{{/entries}}'),

(5, 'languages', 'Languages', 12, 0, 1,
 '[{"name":"language","label":"Language","type":"text","required":true},{"name":"proficiency","label":"Proficiency Level","type":"text","required":true,"placeholder":"Native, Fluent, Intermediate, Basic"}]',
 '\\section*{LANGUAGES}\n{{#entries}}\n\\textbf{{{language}}}: {{proficiency}}\n\n{{/entries}}'),

(5, 'certifications', 'Certifications & Licenses', 13, 0, 1,
 '[{"name":"title","label":"Certification","type":"text","required":true,"placeholder":"e.g., AWS Solutions Architect, PMP"},{"name":"issuer","label":"Issuing Organization","type":"text","required":true},{"name":"year","label":"Year Obtained","type":"text","required":true},{"name":"expiry","label":"Expiry Year","type":"text","placeholder":"No Expiry"},{"name":"credential_id","label":"Credential ID","type":"text"}]',
 '\\section*{CERTIFICATIONS \\& LICENSES}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n\\textit{{{issuer}}}{{#credential_id}} -- ID: {{credential_id}}{{/credential_id}}\n\n{{/entries}}'),

(5, 'awards', 'Awards & Honors', 14, 0, 1,
 '[{"name":"title","label":"Award Title","type":"text","required":true},{"name":"organization","label":"Organization","type":"text"},{"name":"year","label":"Year","type":"text","required":true},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section*{AWARDS \\& HONORS}\n{{#entries}}\n\\textbf{{{title}}}{{#organization}} -- {{organization}}{{/organization}} \\hfill {{year}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(5, 'skills', 'Skills', 15, 0, 1,
 '[{"name":"category","label":"Category","type":"text","required":true,"placeholder":"Programming Languages"},{"name":"skills","label":"Skills","type":"text","required":true,"placeholder":"Python, MATLAB, C++"}]',
 '\\section*{SKILLS}\n{{#entries}}\n\\textbf{{{category}}}: {{skills}}\n\n{{/entries}}'),

(5, 'research_interests', 'Research Interests', 16, 0, 1,
 '[{"name":"area","label":"Research Area","type":"text","required":true,"placeholder":"e.g., Machine Learning, Computational Chemistry"},{"name":"description","label":"Description","type":"textarea","placeholder":"Brief description of this research interest"}]',
 '\\section*{RESEARCH INTERESTS}\n{{#entries}}\n\\textbf{{{area}}}{{#description}}: {{description}}{{/description}}\n\n{{/entries}}'),

(5, 'supervision', 'Student Supervision', 17, 0, 1,
 '[{"name":"student_name","label":"Student Name","type":"text","required":true},{"name":"degree","label":"Degree","type":"text","required":true,"placeholder":"Ph.D., M.Sc., B.Sc."},{"name":"thesis_title","label":"Thesis Title","type":"text"},{"name":"role","label":"Your Role","type":"text","placeholder":"Main Supervisor, Co-Supervisor, Examiner"},{"name":"institution","label":"Institution","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Ongoing"},{"name":"status","label":"Status","type":"text","placeholder":"Completed, In Progress"}]',
 '\\section*{STUDENT SUPERVISION}\n{{#entries}}\n\\textbf{{{student_name}}} ({{degree}}) \\hfill {{year_start}}--{{year_end}}\\\\\n{{#thesis_title}}\\textit{{{thesis_title}}}\\\\{{/thesis_title}}\n{{#role}}{{role}}{{/role}}{{#institution}} | {{institution}}{{/institution}}{{#status}} | {{status}}{{/status}}\n\n{{/entries}}'),

(5, 'editorial', 'Editorial & Reviewing', 18, 0, 1,
 '[{"name":"journal","label":"Journal/Conference","type":"text","required":true},{"name":"role","label":"Role","type":"text","required":true,"placeholder":"Reviewer, Associate Editor, Editorial Board Member"},{"name":"year_start","label":"Since","type":"text","required":true},{"name":"year_end","label":"Until","type":"text","placeholder":"Present"}]',
 '\\section*{EDITORIAL \\& REVIEWING}\n{{#entries}}\n\\textbf{{{journal}}} \\hfill {{year_start}}--{{year_end}}\\\\\n\\textit{{{role}}}\n\n{{/entries}}'),

(5, 'experience', 'Other Professional Experience', 19, 0, 1,
 '[{"name":"position","label":"Position","type":"text","required":true},{"name":"organization","label":"Organization","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section*{OTHER PROFESSIONAL EXPERIENCE}\n{{#entries}}\n\\textbf{{{position}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{organization}}{{#location}}, {{location}}{{/location}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(5, 'references', 'References', 20, 0, 1,
 '[{"name":"name","label":"Name","type":"text","required":true},{"name":"title","label":"Title","type":"text"},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email"},{"name":"phone","label":"Phone","type":"text"}]',
 '\\section*{REFERENCES}\n{{#entries}}\n\\textbf{{{name}}}\\\\\n{{title}}, {{affiliation}}\\\\\n{{email}}{{#phone}} | {{phone}}{{/phone}}\n\n{{/entries}}');


-- =============================================
-- PART 6: Template sections for Research Dossier CV (template_id = 6)
-- Section order: personal_info, academic_appointments, education, research_interests,
--   publications, grants, patents, invited_talks, conferences, teaching, supervision,
--   academic_service, editorial, awards, professional_memberships, projects, references
-- =============================================

INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, is_repeatable, fields_schema, latex_code) VALUES

(6, 'personal_info', 'Personal Information', 1, 1, 0,
 '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"title","label":"Title","type":"text","placeholder":"Dr., Prof."},{"name":"affiliation","label":"Institution","type":"text"},{"name":"current_department","label":"Department","type":"text","placeholder":"Department of Physics"},{"name":"email","label":"Email","type":"email","required":true},{"name":"phone","label":"Phone","type":"text"},{"name":"city_country","label":"City, Country","type":"text","placeholder":"New York, NY, USA"},{"name":"website","label":"Website","type":"url"},{"name":"orcid","label":"ORCID ID","type":"text"},{"name":"google_scholar","label":"Google Scholar URL","type":"url"},{"name":"scopus_profile","label":"Scopus Profile URL","type":"url"}]',
 '\\begin{flushleft}\n{\\large\\bfseries {{full_name}}}\\\\[2pt]\n{{title}}{{#current_department}}, {{current_department}}{{/current_department}}{{#affiliation}}, {{affiliation}}{{/affiliation}}\\\\[2pt]\n{{#city_country}}{{city_country}} | {{/city_country}}{{email}}{{#phone}} | {{phone}}{{/phone}}\\\\[1pt]\n{{#website}}{{website}}{{/website}}{{#orcid}} | ORCID: {{orcid}}{{/orcid}}{{#google_scholar}} | Scholar: {{google_scholar}}{{/google_scholar}}{{#scopus_profile}} | Scopus: {{scopus_profile}}{{/scopus_profile}}\n\\end{flushleft}\\vspace{4pt}'),

(6, 'academic_appointments', 'Academic Appointments', 2, 0, 1,
 '[{"name":"position","label":"Academic Position","type":"text","required":true,"placeholder":"Associate Professor, Postdoctoral Researcher"},{"name":"department","label":"Department / Unit","type":"text","placeholder":"Department of Physics"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"location","label":"Location","type":"text","placeholder":"City, Country"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"status","label":"Appointment Type","type":"text","placeholder":"Tenure-track, Visiting, Permanent, Adjunct"},{"name":"description","label":"Description","type":"textarea","placeholder":"Optional concise description"}]',
 '\\section{Academic Appointments}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{{{position}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#department}}{{department}}, {{/department}}{{institution}}{{#location}}, {{location}}{{/location}}\n{{#description}}\\\\ {{description}}{{/description}}\n{{/entries}}\n\\end{itemize}'),

(6, 'education', 'Education', 3, 0, 1,
 '[{"name":"degree","label":"Degree","type":"text","required":true,"placeholder":"Ph.D. in Physics"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"thesis","label":"Thesis Title","type":"text"},{"name":"supervisor","label":"Supervisor","type":"text","placeholder":"Prof. Jane Doe"},{"name":"gpa","label":"GPA / Distinction","type":"text"}]',
 '\\section{Education}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{{{degree}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{institution}}{{#location}}, {{location}}{{/location}}\\\\\n{{#thesis}}\\textit{Thesis: {{thesis}}}{{/thesis}}{{#supervisor}}\\\\ Supervisor: {{supervisor}}{{/supervisor}}\n{{/entries}}\n\\end{itemize}'),

(6, 'research_interests', 'Research Interests', 4, 0, 1,
 '[{"name":"area","label":"Research Area","type":"text","required":true,"placeholder":"e.g., Machine Learning, Computational Chemistry"},{"name":"description","label":"Description","type":"textarea","placeholder":"Brief description of this research interest"}]',
 '\\section{Research Interests}\n{{#entries}}\n\\textbf{{{area}}}{{#description}}: {{description}}{{/description}}\n\n{{/entries}}'),

(6, 'publications', 'Publications', 5, 0, 1,
 '[{"name":"title","label":"Title","type":"text","required":true},{"name":"authors","label":"Authors","type":"textarea","required":true,"placeholder":"Full author list"},{"name":"year","label":"Year","type":"text","required":true},{"name":"type","label":"Publication Type","type":"text","placeholder":"Journal Article, Conference Paper, Book Chapter, Book, Review, Preprint"},{"name":"peer_review_status","label":"Peer Review Status","type":"text","placeholder":"Peer-reviewed, Non-peer-reviewed"},{"name":"status","label":"Publication Status","type":"text","placeholder":"Published, In Press, Accepted, Under Review, Submitted, Preprint"},{"name":"venue","label":"Journal / Conference / Publisher","type":"text"},{"name":"volume","label":"Volume","type":"text"},{"name":"issue","label":"Issue","type":"text"},{"name":"pages","label":"Pages","type":"text"},{"name":"doi","label":"DOI","type":"text"},{"name":"url","label":"URL","type":"url"},{"name":"candidate_role_note","label":"Role Note","type":"text","placeholder":"First author, Corresponding author, Equal contribution"},{"name":"contribution_note","label":"Contribution Note","type":"textarea","placeholder":"Optional contribution note for middle-author papers"},{"name":"is_selected","label":"Selected Publication","type":"text","placeholder":"yes / no"}]',
 '\\section{Publications}\n\\begin{enumerate}[leftmargin=*]\n{{#entries}}\n\\item {{authors}} ({{year}}). \\textit{{{title}}}. {{venue}}.{{#volume}} {{volume}}{{/volume}}{{#issue}}({{issue}}){{/issue}}{{#pages}}, {{pages}}{{/pages}}.{{#doi}} DOI: {{doi}}{{/doi}}{{#status}} [{{status}}]{{/status}}{{#candidate_role_note}} ({{candidate_role_note}}){{/candidate_role_note}}\n{{/entries}}\n\\end{enumerate}'),

(6, 'grants', 'Grants & Funding', 6, 0, 1,
 '[{"name":"title","label":"Grant Title","type":"text","required":true},{"name":"agency","label":"Funding Agency","type":"text","required":true},{"name":"amount","label":"Amount","type":"text","placeholder":"e.g., $100,000"},{"name":"role","label":"Role","type":"text","placeholder":"PI, Co-PI, Named Investigator"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"status","label":"Status","type":"text","placeholder":"Active, Completed, Pending"},{"name":"grant_number","label":"Grant Number","type":"text","placeholder":"Grant/Award reference number"},{"name":"collaborators","label":"Co-Investigators","type":"text","placeholder":"Names of co-investigators"}]',
 '\\section{Grants \\& Funding}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{agency}}{{#amount}} -- {{amount}}{{/amount}}{{#grant_number}} ({{grant_number}}){{/grant_number}}\\\\\n{{#role}}Role: {{role}}{{/role}}{{#status}} | {{status}}{{/status}}{{#collaborators}}\\\\ Co-Investigators: {{collaborators}}{{/collaborators}}\n\n{{/entries}}'),

(6, 'patents', 'Patents', 7, 0, 1,
 '[{"name":"title","label":"Patent Title","type":"text","required":true},{"name":"inventors","label":"Inventors","type":"text","required":true,"placeholder":"Inventor list"},{"name":"patent_number","label":"Patent Number","type":"text","placeholder":"US1234567 / WO..."},{"name":"jurisdiction","label":"Jurisdiction","type":"text","placeholder":"US, EP, PCT"},{"name":"status","label":"Status","type":"text","placeholder":"Granted, Filed, Published"},{"name":"year","label":"Year","type":"text","required":true},{"name":"url","label":"Link","type":"url","placeholder":"Patent database URL"}]',
 '\\section{Patents}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n{{inventors}}\\\\\n{{#patent_number}}{{patent_number}}{{/patent_number}}{{#jurisdiction}} ({{jurisdiction}}){{/jurisdiction}}{{#status}} -- {{status}}{{/status}}\n\n{{/entries}}'),

(6, 'invited_talks', 'Invited Talks', 8, 0, 1,
 '[{"name":"title","label":"Talk Title","type":"text","required":true},{"name":"host","label":"Host Institution / Organizer","type":"text","required":true,"placeholder":"Stanford University / IEEE"},{"name":"event","label":"Event / Seminar Series","type":"text","placeholder":"Materials Seminar Series"},{"name":"location","label":"Location","type":"text","placeholder":"Oxford, UK"},{"name":"year","label":"Year","type":"text","required":true},{"name":"type","label":"Type","type":"text","placeholder":"Invited, Keynote, Plenary"}]',
 '\\section{Invited Talks}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n{{host}}{{#event}}, {{event}}{{/event}}{{#location}}, {{location}}{{/location}}{{#type}} ({{type}}){{/type}}\n\n{{/entries}}'),

(6, 'conferences', 'Conference Presentations', 9, 0, 1,
 '[{"name":"title","label":"Presentation Title","type":"text","required":true},{"name":"conference","label":"Conference Name","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year","label":"Year","type":"text","required":true},{"name":"type","label":"Type","type":"text","placeholder":"Oral, Poster, Keynote, Invited Talk"}]',
 '\\section{Conference Presentations}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n{{conference}}{{#location}}, {{location}}{{/location}}{{#type}} ({{type}}){{/type}}\n\n{{/entries}}'),

(6, 'teaching', 'Teaching Experience', 10, 0, 1,
 '[{"name":"course","label":"Course Name","type":"text","required":true,"placeholder":"e.g., Introduction to Physics"},{"name":"code","label":"Course Code","type":"text","placeholder":"e.g., PHY101"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"level","label":"Level","type":"text","placeholder":"Undergraduate, Graduate, Postgraduate"},{"name":"role","label":"Role","type":"text","placeholder":"Lecturer, Teaching Assistant, Instructor"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section{Teaching Experience}\n{{#entries}}\n\\textbf{{{course}}}{{#code}} ({{code}}){{/code}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#role}}{{role}}, {{/role}}{{institution}}{{#level}} -- {{level}}{{/level}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(6, 'supervision', 'Student Supervision', 11, 0, 1,
 '[{"name":"student_name","label":"Student Name","type":"text","required":true},{"name":"degree","label":"Degree","type":"text","required":true,"placeholder":"Ph.D., M.Sc., B.Sc."},{"name":"thesis_title","label":"Thesis Title","type":"text"},{"name":"role","label":"Your Role","type":"text","placeholder":"Main Supervisor, Co-Supervisor, Examiner"},{"name":"institution","label":"Institution","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Ongoing"},{"name":"status","label":"Status","type":"text","placeholder":"Completed, In Progress"}]',
 '\\section{Student Supervision}\n{{#entries}}\n\\textbf{{{student_name}}} ({{degree}}) \\hfill {{year_start}}--{{year_end}}\\\\\n{{#thesis_title}}\\textit{{{thesis_title}}}\\\\{{/thesis_title}}\n{{#role}}{{role}}{{/role}}{{#institution}} | {{institution}}{{/institution}}{{#status}} | {{status}}{{/status}}\n\n{{/entries}}'),

(6, 'academic_service', 'Academic Service', 12, 0, 1,
 '[{"name":"activity","label":"Service Activity","type":"text","required":true,"placeholder":"Curriculum Committee, Conference Organizer"},{"name":"role","label":"Role","type":"text","placeholder":"Chair, Member, Coordinator"},{"name":"organization","label":"Organization / Unit","type":"text","placeholder":"Faculty of Engineering / IEEE"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea","placeholder":"Optional concise description"}]',
 '\\section{Academic Service}\n{{#entries}}\n\\textbf{{{activity}}}{{#role}} -- {{role}}{{/role}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#organization}}{{organization}}{{/organization}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(6, 'editorial', 'Editorial & Reviewing', 13, 0, 1,
 '[{"name":"journal","label":"Journal/Conference","type":"text","required":true},{"name":"role","label":"Role","type":"text","required":true,"placeholder":"Reviewer, Associate Editor, Editorial Board Member"},{"name":"year_start","label":"Since","type":"text","required":true},{"name":"year_end","label":"Until","type":"text","placeholder":"Present"}]',
 '\\section{Editorial \\& Reviewing}\n{{#entries}}\n\\textbf{{{journal}}} \\hfill {{year_start}}--{{year_end}}\\\\\n\\textit{{{role}}}\n\n{{/entries}}'),

(6, 'awards', 'Awards & Honors', 14, 0, 1,
 '[{"name":"title","label":"Award Title","type":"text","required":true},{"name":"organization","label":"Organization","type":"text"},{"name":"year","label":"Year","type":"text","required":true},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section{Awards \\& Honors}\n{{#entries}}\n\\textbf{{{title}}}{{#organization}} -- {{organization}}{{/organization}} \\hfill {{year}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(6, 'professional_memberships', 'Professional Memberships', 15, 0, 1,
 '[{"name":"organization","label":"Organization","type":"text","required":true,"placeholder":"e.g., IEEE, ACM, ACS"},{"name":"role","label":"Role/Grade","type":"text","placeholder":"Fellow, Senior Member, Member"},{"name":"year_start","label":"Since","type":"text","required":true},{"name":"year_end","label":"Until","type":"text","placeholder":"Present"}]',
 '\\section{Professional Memberships}\n{{#entries}}\n\\textbf{{{organization}}}{{#role}} -- {{role}}{{/role}} \\hfill {{year_start}}--{{year_end}}\n\n{{/entries}}'),

(6, 'projects', 'Projects', 16, 0, 1,
 '[{"name":"title","label":"Project Title","type":"text","required":true},{"name":"role","label":"Role","type":"text","placeholder":"Principal Investigator, Co-PI, Researcher"},{"name":"organization","label":"Organization/Funder","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section{Projects}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{#role}}\\textit{{{role}}}{{/role}}{{#organization}}, {{organization}}{{/organization}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(6, 'skills', 'Skills', 17, 0, 1,
 '[{"name":"category","label":"Category","type":"text","required":true,"placeholder":"Programming Languages"},{"name":"skills","label":"Skills","type":"text","required":true,"placeholder":"Python, MATLAB, C++"}]',
 '\\section{Skills}\n{{#entries}}\n\\textbf{{{category}}}: {{skills}}\n\n{{/entries}}'),

(6, 'languages', 'Languages', 18, 0, 1,
 '[{"name":"language","label":"Language","type":"text","required":true},{"name":"proficiency","label":"Proficiency Level","type":"text","required":true,"placeholder":"Native, Fluent, Intermediate, Basic"}]',
 '\\section{Languages}\n{{#entries}}\n\\textbf{{{language}}}: {{proficiency}}\n\n{{/entries}}'),

(6, 'certifications', 'Certifications & Licenses', 19, 0, 1,
 '[{"name":"title","label":"Certification","type":"text","required":true,"placeholder":"e.g., AWS Solutions Architect, PMP"},{"name":"issuer","label":"Issuing Organization","type":"text","required":true},{"name":"year","label":"Year Obtained","type":"text","required":true},{"name":"expiry","label":"Expiry Year","type":"text","placeholder":"No Expiry"},{"name":"credential_id","label":"Credential ID","type":"text"}]',
 '\\section{Certifications \\& Licenses}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n\\textit{{{issuer}}}{{#credential_id}} -- ID: {{credential_id}}{{/credential_id}}\n\n{{/entries}}'),

(6, 'experience', 'Other Professional Experience', 20, 0, 1,
 '[{"name":"position","label":"Position","type":"text","required":true},{"name":"organization","label":"Organization","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section{Other Professional Experience}\n{{#entries}}\n\\textbf{{{position}}} \\hfill {{year_start}}--{{year_end}}\\\\\n{{organization}}{{#location}}, {{location}}{{/location}}\n{{#description}}\\\\ {{description}}{{/description}}\n\n{{/entries}}'),

(6, 'references', 'References', 21, 0, 1,
 '[{"name":"name","label":"Name","type":"text","required":true},{"name":"title","label":"Title","type":"text"},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email"},{"name":"phone","label":"Phone","type":"text"}]',
 '\\section{References}\n{{#entries}}\n\\textbf{{{name}}}\\\\\n{{title}}, {{affiliation}}\\\\\n{{email}}{{#phone}} | {{phone}}{{/phone}}\n\n{{/entries}}');
