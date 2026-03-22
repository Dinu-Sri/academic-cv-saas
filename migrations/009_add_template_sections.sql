-- Migration 009: Add additional sections to Modern & Detailed templates
-- Classic (1): add research_interests, projects
-- Modern (2): add research_interests, projects, certifications, languages, professional_memberships
-- Detailed (3): add research_interests, projects, teaching, supervision, grants, conferences, certifications, languages, professional_memberships, editorial

-- =============================================
-- CLASSIC ACADEMIC (template_id = 1) — 2 new sections
-- =============================================

INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, is_repeatable, fields_schema, latex_code) VALUES
(1, 'research_interests', 'Research Interests', 8, 0, 1,
 '[{"name":"area","label":"Research Area","type":"text","required":true,"placeholder":"e.g., Machine Learning, Computational Chemistry"},{"name":"description","label":"Description","type":"textarea","placeholder":"Brief description of this research interest"}]',
 '\\section*{Research Interests}\n{{#entries}}\n\\textbf{{{area}}}{{#description}}: {{description}}{{/description}}\n\n{{/entries}}'),

(1, 'projects', 'Projects', 9, 0, 1,
 '[{"name":"title","label":"Project Title","type":"text","required":true},{"name":"role","label":"Role","type":"text","placeholder":"Principal Investigator, Co-PI, Researcher"},{"name":"organization","label":"Organization/Funder","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section*{Projects}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}} -- {{year_end}}\\\\\n{{#role}}\\textit{{{role}}}{{/role}}{{#organization}}, {{organization}}{{/organization}}\n{{#description}}\n\n{{description}}\n{{/description}}\n\n{{/entries}}');


-- =============================================
-- MODERN PROFESSIONAL (template_id = 2) — 5 new sections
-- =============================================

INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, is_repeatable, fields_schema, latex_code) VALUES
(2, 'research_interests', 'Research Interests', 8, 0, 1,
 '[{"name":"area","label":"Research Area","type":"text","required":true,"placeholder":"e.g., Machine Learning, Computational Chemistry"},{"name":"description","label":"Description","type":"textarea","placeholder":"Brief description of this research interest"}]',
 '\\section*{Research Interests}\n{{#entries}}\n\\textbf{{{area}}}{{#description}}: {{description}}{{/description}}\n\n{{/entries}}'),

(2, 'projects', 'Projects', 9, 0, 1,
 '[{"name":"title","label":"Project Title","type":"text","required":true},{"name":"role","label":"Role","type":"text","placeholder":"Principal Investigator, Co-PI, Researcher"},{"name":"organization","label":"Organization/Funder","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section*{Projects}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}} -- {{year_end}}\\\\\n{{#role}}\\textit{{{role}}}{{/role}}{{#organization}}, {{organization}}{{/organization}}\n{{#description}}\n\n{{description}}\n{{/description}}\n\n{{/entries}}'),

(2, 'certifications', 'Certifications & Licenses', 10, 0, 1,
 '[{"name":"title","label":"Certification","type":"text","required":true,"placeholder":"e.g., AWS Solutions Architect, PMP"},{"name":"issuer","label":"Issuing Organization","type":"text","required":true},{"name":"year","label":"Year Obtained","type":"text","required":true},{"name":"expiry","label":"Expiry Year","type":"text","placeholder":"No Expiry"},{"name":"credential_id","label":"Credential ID","type":"text"}]',
 '\\section*{Certifications \\& Licenses}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n\\textit{{{issuer}}}{{#credential_id}} -- ID: {{credential_id}}{{/credential_id}}\n\n{{/entries}}'),

(2, 'languages', 'Languages', 11, 0, 1,
 '[{"name":"language","label":"Language","type":"text","required":true},{"name":"proficiency","label":"Proficiency Level","type":"text","required":true,"placeholder":"Native, Fluent, Intermediate, Basic"}]',
 '\\section*{Languages}\n{{#entries}}\n\\textbf{{{language}}}: {{proficiency}}\n\n{{/entries}}'),

(2, 'professional_memberships', 'Professional Memberships', 12, 0, 1,
 '[{"name":"organization","label":"Organization","type":"text","required":true,"placeholder":"e.g., IEEE, ACM, ACS"},{"name":"role","label":"Role/Grade","type":"text","placeholder":"Fellow, Senior Member, Member"},{"name":"year_start","label":"Since","type":"text","required":true},{"name":"year_end","label":"Until","type":"text","placeholder":"Present"}]',
 '\\section*{Professional Memberships}\n{{#entries}}\n\\textbf{{{organization}}}{{#role}} -- {{role}}{{/role}} \\hfill {{year_start}} -- {{year_end}}\n\n{{/entries}}');


-- =============================================
-- DETAILED ACADEMIC (template_id = 3) — 10 new sections
-- =============================================

INSERT IGNORE INTO template_sections (template_id, section_key, display_name, section_order, is_required, is_repeatable, fields_schema, latex_code) VALUES
(3, 'research_interests', 'Research Interests', 8, 0, 1,
 '[{"name":"area","label":"Research Area","type":"text","required":true,"placeholder":"e.g., Machine Learning, Computational Chemistry"},{"name":"keywords","label":"Keywords","type":"text","placeholder":"Comma-separated keywords"},{"name":"description","label":"Description","type":"textarea","placeholder":"Brief description of this research interest"}]',
 '\\section*{Research Interests}\n{{#entries}}\n\\textbf{{{area}}}{{#description}}: {{description}}{{/description}}{{#keywords}}\\\\ \\textit{Keywords: {{keywords}}}{{/keywords}}\n\n{{/entries}}'),

(3, 'projects', 'Research Projects', 9, 0, 1,
 '[{"name":"title","label":"Project Title","type":"text","required":true},{"name":"role","label":"Role","type":"text","placeholder":"Principal Investigator, Co-PI"},{"name":"funding_agency","label":"Funding Agency","type":"text"},{"name":"amount","label":"Funding Amount","type":"text","placeholder":"e.g., $50,000"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section*{Research Projects}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}} -- {{year_end}}\\\\\n{{#role}}\\textit{{{role}}}{{/role}}{{#funding_agency}}, {{funding_agency}}{{/funding_agency}}{{#amount}} ({{amount}}){{/amount}}\n{{#description}}\n\n{{description}}\n{{/description}}\n\n{{/entries}}'),

(3, 'teaching', 'Teaching Experience', 10, 0, 1,
 '[{"name":"course","label":"Course Name","type":"text","required":true,"placeholder":"e.g., Introduction to Physics"},{"name":"code","label":"Course Code","type":"text","placeholder":"e.g., PHY101"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"level","label":"Level","type":"text","placeholder":"Undergraduate, Graduate, Postgraduate"},{"name":"role","label":"Role","type":"text","placeholder":"Lecturer, Teaching Assistant, Instructor"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]',
 '\\section*{Teaching Experience}\n{{#entries}}\n\\textbf{{{course}}}{{#code}} ({{code}}){{/code}} \\hfill {{year_start}} -- {{year_end}}\\\\\n\\textit{{{role}}}, {{institution}}{{#level}} -- {{level}}{{/level}}\n{{#description}}\n\n{{description}}\n{{/description}}\n\n{{/entries}}'),

(3, 'supervision', 'Student Supervision', 11, 0, 1,
 '[{"name":"student_name","label":"Student Name","type":"text","required":true},{"name":"degree","label":"Degree","type":"text","required":true,"placeholder":"Ph.D., M.Sc., B.Sc."},{"name":"thesis_title","label":"Thesis/Project Title","type":"text"},{"name":"role","label":"Your Role","type":"text","placeholder":"Main Supervisor, Co-Supervisor, Examiner"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Ongoing"},{"name":"status","label":"Status","type":"text","placeholder":"Completed, In Progress"}]',
 '\\section*{Student Supervision}\n{{#entries}}\n\\textbf{{{student_name}}} ({{degree}}) \\hfill {{year_start}} -- {{year_end}}\\\\\n{{#thesis_title}}\\textit{{{thesis_title}}}\\\\{{/thesis_title}}\n{{#role}}Role: {{role}}{{/role}}{{#status}} -- {{status}}{{/status}}\n\n{{/entries}}'),

(3, 'grants', 'Grants & Funding', 12, 0, 1,
 '[{"name":"title","label":"Grant Title","type":"text","required":true},{"name":"agency","label":"Funding Agency","type":"text","required":true},{"name":"amount","label":"Amount","type":"text","placeholder":"e.g., $100,000"},{"name":"role","label":"Role","type":"text","placeholder":"PI, Co-PI, Named Investigator"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"status","label":"Status","type":"text","placeholder":"Active, Completed, Pending"}]',
 '\\section*{Grants \\& Funding}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year_start}} -- {{year_end}}\\\\\n{{agency}}{{#amount}} -- {{amount}}{{/amount}}\\\\\n{{#role}}Role: {{role}}{{/role}}{{#status}} | Status: {{status}}{{/status}}\n\n{{/entries}}'),

(3, 'conferences', 'Conference Presentations', 13, 0, 1,
 '[{"name":"title","label":"Presentation Title","type":"text","required":true},{"name":"conference","label":"Conference Name","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year","label":"Year","type":"text","required":true},{"name":"type","label":"Type","type":"text","placeholder":"Oral, Poster, Keynote, Invited Talk"}]',
 '\\section*{Conference Presentations}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n{{conference}}{{#location}}, {{location}}{{/location}}{{#type}} ({{type}}){{/type}}\n\n{{/entries}}'),

(3, 'certifications', 'Certifications & Licenses', 14, 0, 1,
 '[{"name":"title","label":"Certification","type":"text","required":true,"placeholder":"e.g., AWS Solutions Architect, PMP"},{"name":"issuer","label":"Issuing Organization","type":"text","required":true},{"name":"year","label":"Year Obtained","type":"text","required":true},{"name":"expiry","label":"Expiry Year","type":"text","placeholder":"No Expiry"},{"name":"credential_id","label":"Credential ID","type":"text"}]',
 '\\section*{Certifications \\& Licenses}\n{{#entries}}\n\\textbf{{{title}}} \\hfill {{year}}\\\\\n\\textit{{{issuer}}}{{#credential_id}} -- ID: {{credential_id}}{{/credential_id}}\n\n{{/entries}}'),

(3, 'languages', 'Languages', 15, 0, 1,
 '[{"name":"language","label":"Language","type":"text","required":true},{"name":"proficiency","label":"Proficiency Level","type":"text","required":true,"placeholder":"Native, Fluent, Intermediate, Basic"}]',
 '\\section*{Languages}\n{{#entries}}\n\\textbf{{{language}}}: {{proficiency}}\n\n{{/entries}}'),

(3, 'professional_memberships', 'Professional Memberships', 16, 0, 1,
 '[{"name":"organization","label":"Organization","type":"text","required":true,"placeholder":"e.g., IEEE, ACM, ACS"},{"name":"role","label":"Role/Grade","type":"text","placeholder":"Fellow, Senior Member, Member"},{"name":"year_start","label":"Since","type":"text","required":true},{"name":"year_end","label":"Until","type":"text","placeholder":"Present"}]',
 '\\section*{Professional Memberships}\n{{#entries}}\n\\textbf{{{organization}}}{{#role}} -- {{role}}{{/role}} \\hfill {{year_start}} -- {{year_end}}\n\n{{/entries}}'),

(3, 'editorial', 'Editorial & Reviewing', 17, 0, 1,
 '[{"name":"journal","label":"Journal/Conference","type":"text","required":true},{"name":"role","label":"Role","type":"text","required":true,"placeholder":"Reviewer, Associate Editor, Editorial Board Member"},{"name":"year_start","label":"Since","type":"text","required":true},{"name":"year_end","label":"Until","type":"text","placeholder":"Present"}]',
 '\\section*{Editorial \\& Reviewing}\n{{#entries}}\n\\textbf{{{journal}}} \\hfill {{year_start}} -- {{year_end}}\\\\\n\\textit{{{role}}}\n\n{{/entries}}');
