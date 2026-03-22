-- 002_seed_templates.sql
-- Seed default template and section definitions
-- Uses INSERT IGNORE to avoid duplicates on re-run

INSERT IGNORE INTO templates (id, name, slug, description, preview_image, latex_header, latex_footer, is_premium, is_active, style_config)
VALUES (1, 'Classic Academic', 'classic-academic', 'Traditional academic CV layout with clean typography',
    '/assets/images/classic-preview.png',
    '\\documentclass[11pt,a4paper]{article}\n\\usepackage[margin=1in]{geometry}\n\\usepackage{enumitem}\n\\usepackage{hyperref}\n\\usepackage{titlesec}\n\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}\n\\titlespacing{\\section}{0pt}{12pt}{6pt}\n\\begin{document}',
    '\\end{document}',
    0, 1,
    '{"font_family": "Computer Modern", "font_size": "11pt", "margin": "1in", "line_spacing": 1.15}'
);

INSERT IGNORE INTO template_sections (id, template_id, section_key, display_name, latex_code, section_order, is_required, is_repeatable, fields_schema)
VALUES
(1, 1, 'personal_info', 'Personal Information',
 '\\begin{center}\n{\\LARGE\\bfseries <<full_name>>}\\\\[4pt]\n<<title>> \\\\[2pt]\n<<email>> | <<phone>> | <<location>>\n\\end{center}',
 1, 1, 0,
 '{"fields": [{"key": "full_name", "label": "Full Name", "type": "text", "required": true}, {"key": "title", "label": "Title/Position", "type": "text"}, {"key": "email", "label": "Email", "type": "email", "required": true}, {"key": "phone", "label": "Phone", "type": "text"}, {"key": "location", "label": "Location", "type": "text"}, {"key": "website", "label": "Website", "type": "url"}, {"key": "orcid", "label": "ORCID ID", "type": "text"}, {"key": "linkedin", "label": "LinkedIn", "type": "url"}]}'
),
(2, 1, 'education', 'Education',
 '\\section{Education}\n<<entries>>\n\\textbf{<<degree>>}, <<institution>> \\hfill <<year_start>> -- <<year_end>>\\\\\n<<field_of_study>>\n<</entries>>',
 2, 0, 1,
 '{"fields": [{"key": "degree", "label": "Degree", "type": "text", "required": true}, {"key": "institution", "label": "Institution", "type": "text", "required": true}, {"key": "field_of_study", "label": "Field of Study", "type": "text"}, {"key": "year_start", "label": "Start Year", "type": "text"}, {"key": "year_end", "label": "End Year", "type": "text"}, {"key": "gpa", "label": "GPA", "type": "text"}, {"key": "description", "label": "Description", "type": "textarea"}]}'
),
(3, 1, 'experience', 'Work Experience',
 '\\section{Work Experience}\n<<entries>>\n\\textbf{<<position>>}, <<organization>> \\hfill <<year_start>> -- <<year_end>>\\\\\n<<description>>\n<</entries>>',
 3, 0, 1,
 '{"fields": [{"key": "position", "label": "Position", "type": "text", "required": true}, {"key": "organization", "label": "Organization", "type": "text", "required": true}, {"key": "year_start", "label": "Start Year", "type": "text"}, {"key": "year_end", "label": "End Year", "type": "text"}, {"key": "description", "label": "Description", "type": "textarea"}]}'
),
(4, 1, 'publications', 'Publications',
 '\\section{Publications}\n\\begin{enumerate}\n<<entries>>\n\\item <<authors>> (<<year>>). <<title>>. \\textit{<<venue>>}.\n<</entries>>\n\\end{enumerate}',
 4, 0, 1,
 '{"fields": [{"key": "title", "label": "Title", "type": "text", "required": true}, {"key": "authors", "label": "Authors", "type": "text", "required": true}, {"key": "year", "label": "Year", "type": "text"}, {"key": "venue", "label": "Journal/Conference", "type": "text"}, {"key": "doi", "label": "DOI", "type": "text"}, {"key": "url", "label": "URL", "type": "url"}]}'
),
(5, 1, 'skills', 'Skills',
 '\\section{Skills}\n<<entries>>\n\\textbf{<<category>>:} <<skills>>\\\\\n<</entries>>',
 5, 0, 1,
 '{"fields": [{"key": "category", "label": "Category", "type": "text", "required": true}, {"key": "skills", "label": "Skills", "type": "textarea", "required": true}]}'
),
(6, 1, 'awards', 'Awards & Honors',
 '\\section{Awards \\& Honors}\n<<entries>>\n\\textbf{<<title>>} \\hfill <<year>>\\\\\n<<organization>>\\\\\n<<description>>\n<</entries>>',
 6, 0, 1,
 '{"fields": [{"key": "title", "label": "Award Title", "type": "text", "required": true}, {"key": "organization", "label": "Organization", "type": "text"}, {"key": "year", "label": "Year", "type": "text"}, {"key": "description", "label": "Description", "type": "textarea"}]}'
),
(7, 1, 'references', 'References',
 '\\section{References}\n<<entries>>\n\\textbf{<<name>>}\\\\\n<<title>>, <<institution>>\\\\\n<<email>> | <<phone>>\n<</entries>>',
 7, 0, 1,
 '{"fields": [{"key": "name", "label": "Name", "type": "text", "required": true}, {"key": "title", "label": "Title", "type": "text"}, {"key": "institution", "label": "Institution", "type": "text"}, {"key": "email", "label": "Email", "type": "email"}, {"key": "phone", "label": "Phone", "type": "text"}]}'
);
