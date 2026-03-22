-- 004_fix_templates_add_missing.sql
-- Fix Classic template (wrong slug, wrong fields_schema format) and add Modern + Detailed templates

-- Fix Classic Academic template slug and metadata
UPDATE templates SET
    slug = 'classic',
    latex_header = '\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=1in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{xcolor}

\\definecolor{headercolor}{RGB}{0,51,102}
\\titleformat{\\section}{\\large\\bfseries\\color{headercolor}}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{12pt}{6pt}

\\pagestyle{empty}
\\begin{document}',
    latex_footer = '\\end{document}',
    style_config = '{"primaryColor": "#003366", "fontFamily": "lmodern", "fontSize": "11pt", "margins": "1in"}'
WHERE id = 1;

-- Fix Classic template_sections fields_schema (was {"fields":[{"key":...}]}, now plain array with "name")
UPDATE template_sections SET fields_schema = '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"title","label":"Title","type":"text","placeholder":"Dr., Prof."},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email","required":true},{"name":"phone","label":"Phone","type":"text"},{"name":"address","label":"Address","type":"textarea"},{"name":"website","label":"Website","type":"url"},{"name":"orcid","label":"ORCID ID","type":"text"}]'
WHERE template_id = 1 AND section_key = 'personal_info';

UPDATE template_sections SET fields_schema = '[{"name":"degree","label":"Degree","type":"text","required":true,"placeholder":"Ph.D. in Physics"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"thesis","label":"Thesis Title","type":"text"},{"name":"gpa","label":"GPA","type":"text"}]'
WHERE template_id = 1 AND section_key = 'education';

UPDATE template_sections SET fields_schema = '[{"name":"position","label":"Position","type":"text","required":true},{"name":"organization","label":"Organization","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]'
WHERE template_id = 1 AND section_key = 'experience';

UPDATE template_sections SET fields_schema = '[{"name":"title","label":"Title","type":"text","required":true},{"name":"authors","label":"Authors","type":"text","required":true},{"name":"year","label":"Year","type":"text","required":true},{"name":"venue","label":"Journal/Conference","type":"text"},{"name":"doi","label":"DOI","type":"text"},{"name":"url","label":"URL","type":"url"}]'
WHERE template_id = 1 AND section_key = 'publications';

UPDATE template_sections SET fields_schema = '[{"name":"category","label":"Category","type":"text","required":true,"placeholder":"Programming Languages"},{"name":"skills","label":"Skills","type":"text","required":true,"placeholder":"Python, MATLAB, C++"}]'
WHERE template_id = 1 AND section_key = 'skills';

UPDATE template_sections SET fields_schema = '[{"name":"title","label":"Award Title","type":"text","required":true},{"name":"organization","label":"Organization","type":"text"},{"name":"year","label":"Year","type":"text","required":true},{"name":"description","label":"Description","type":"textarea"}]'
WHERE template_id = 1 AND section_key = 'awards';

UPDATE template_sections SET fields_schema = '[{"name":"name","label":"Name","type":"text","required":true},{"name":"title","label":"Title","type":"text"},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email"},{"name":"phone","label":"Phone","type":"text"}]'
WHERE template_id = 1 AND section_key = 'references';

-- Also fix latex_code for Classic sections to use {{mustache}} syntax
UPDATE template_sections SET latex_code = '\\begin{center}\n{\\LARGE\\bfseries {{full_name}}}\\\\[4pt]\n{{title}}{{#affiliation}}, {{affiliation}}{{/affiliation}}\\\\[2pt]\n{{email}} {{#phone}}\\quad|\\quad {{phone}}{{/phone}}\\\\\n{{#website}}\\url{ {{website}} }{{/website}} {{#orcid}}\\quad|\\quad ORCID: {{orcid}}{{/orcid}}\n\\end{center}\\vspace{8pt}'
WHERE template_id = 1 AND section_key = 'personal_info';

UPDATE template_sections SET latex_code = '\\section{Education}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{ {{degree}} } \\hfill {{year_start}}--{{year_end}}\\\\\n{{institution}} {{#location}}\\hfill {{location}}{{/location}}\\\\\n{{#thesis}}\\textit{Thesis: {{thesis}} }{{/thesis}}\n{{/entries}}\n\\end{itemize}'
WHERE template_id = 1 AND section_key = 'education';

UPDATE template_sections SET latex_code = '\\section{Work Experience}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{ {{position}} } \\hfill {{year_start}}--{{year_end}}\\\\\n{{organization}} {{#location}}\\hfill {{location}}{{/location}}\\\\\n{{#description}}{{description}}{{/description}}\n{{/entries}}\n\\end{itemize}'
WHERE template_id = 1 AND section_key = 'experience';

UPDATE template_sections SET latex_code = '\\section{Publications}\n\\begin{enumerate}[leftmargin=*]\n{{#entries}}\n\\item {{authors}} ({{year}}). \\textit{ {{title}} }. {{venue}}.{{#doi}} DOI: {{doi}}{{/doi}}\n{{/entries}}\n\\end{enumerate}'
WHERE template_id = 1 AND section_key = 'publications';

UPDATE template_sections SET latex_code = '\\section{Skills}\n\\begin{itemize}[leftmargin=*]\n{{#entries}}\n\\item \\textbf{ {{category}} }: {{skills}}\n{{/entries}}\n\\end{itemize}'
WHERE template_id = 1 AND section_key = 'skills';

UPDATE template_sections SET latex_code = '\\section{Awards \\& Honors}\n\\begin{itemize}[leftmargin=*]\n{{#entries}}\n\\item \\textbf{ {{title}} } {{#organization}}-- {{organization}}{{/organization}} \\hfill {{year}}\n{{/entries}}\n\\end{itemize}'
WHERE template_id = 1 AND section_key = 'awards';

UPDATE template_sections SET latex_code = '\\section{References}\n\\begin{itemize}[leftmargin=0pt, label={}]\n{{#entries}}\n\\item \\textbf{ {{name}} }\\\\\n{{title}}, {{affiliation}}\\\\\n{{email}} {{#phone}}\\quad|\\quad {{phone}}{{/phone}}\n{{/entries}}\n\\end{itemize}'
WHERE template_id = 1 AND section_key = 'references';

-- Add Modern Professional Template
INSERT IGNORE INTO templates (id, name, slug, description, latex_header, latex_footer, is_premium, is_active, style_config)
VALUES (2, 'Modern Professional', 'modern', 'Contemporary design with accent colors and a sidebar layout.',
'\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{raleway}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{fontawesome5}

\\definecolor{accent}{RGB}{0,119,181}
\\definecolor{darktext}{RGB}{51,51,51}
\\color{darktext}

\\titleformat{\\section}{\\Large\\bfseries\\color{accent}}{}{0em}{}[{\\color{accent}\\titlerule[1.5pt]}]
\\titlespacing*{\\section}{0pt}{14pt}{8pt}

\\pagestyle{empty}
\\begin{document}',
'\\end{document}',
0, 1,
'{"primaryColor": "#0077B5", "fontFamily": "raleway", "fontSize": "11pt", "margins": "0.75in"}');

-- Add Detailed Academic Template
INSERT IGNORE INTO templates (id, name, slug, description, latex_header, latex_footer, is_premium, is_active, style_config)
VALUES (3, 'Detailed Academic', 'detailed', 'Comprehensive template for senior academics with publication lists and grants.',
'\\documentclass[10pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{ebgaramond}
\\usepackage[margin=0.9in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{longtable}

\\definecolor{headercolor}{RGB}{102,0,0}
\\titleformat{\\section}{\\large\\scshape\\color{headercolor}}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{10pt}{5pt}

\\pagestyle{plain}
\\begin{document}',
'\\end{document}',
0, 1,
'{"primaryColor": "#660000", "fontFamily": "ebgaramond", "fontSize": "10pt", "margins": "0.9in"}');

-- Modern Template Sections
INSERT IGNORE INTO template_sections (template_id, section_key, display_name, latex_code, section_order, is_required, is_repeatable, fields_schema)
VALUES
(2, 'personal_info', 'Personal Information',
'\\begin{center}\n{\\LARGE\\bfseries {{full_name}}}\\\\[4pt]\n{{title}}\\\\[2pt]\n{{email}} | {{phone}}\n\\end{center}',
1, 1, 0,
'[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"title","label":"Title","type":"text"},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email","required":true},{"name":"phone","label":"Phone","type":"text"},{"name":"website","label":"Website","type":"url"},{"name":"orcid","label":"ORCID ID","type":"text"}]'),

(2, 'education', 'Education',
'\\section{Education}\n{{#entries}}\n\\textbf{ {{degree}} } \\hfill {{year_start}}--{{year_end}}\\\\\n{{institution}}\n{{/entries}}',
2, 0, 1,
'[{"name":"degree","label":"Degree","type":"text","required":true},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text"},{"name":"gpa","label":"GPA","type":"text"}]'),

(2, 'experience', 'Work Experience',
'\\section{Experience}\n{{#entries}}\n\\textbf{ {{position}} } \\hfill {{year_start}}--{{year_end}}\\\\\n{{organization}}\\\\\n{{description}}\n{{/entries}}',
3, 0, 1,
'[{"name":"position","label":"Position","type":"text","required":true},{"name":"organization","label":"Organization","type":"text","required":true},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text"},{"name":"description","label":"Description","type":"textarea"}]'),

(2, 'publications', 'Publications',
'\\section{Publications}\n\\begin{enumerate}\n{{#entries}}\n\\item {{authors}} ({{year}}). {{title}}. \\textit{ {{venue}} }.\n{{/entries}}\n\\end{enumerate}',
4, 0, 1,
'[{"name":"title","label":"Title","type":"text","required":true},{"name":"authors","label":"Authors","type":"text","required":true},{"name":"year","label":"Year","type":"text","required":true},{"name":"venue","label":"Journal/Conference","type":"text"},{"name":"doi","label":"DOI","type":"text"}]'),

(2, 'skills', 'Skills',
'\\section{Skills}\n{{#entries}}\n\\textbf{ {{category}} }: {{skills}}\\\\\n{{/entries}}',
5, 0, 1,
'[{"name":"category","label":"Category","type":"text","required":true},{"name":"skills","label":"Skills","type":"text","required":true}]'),

(2, 'awards', 'Awards & Honors',
'\\section{Awards}\n{{#entries}}\n\\textbf{ {{title}} } \\hfill {{year}}\\\\\n{{organization}}\n{{/entries}}',
6, 0, 1,
'[{"name":"title","label":"Award Title","type":"text","required":true},{"name":"organization","label":"Organization","type":"text"},{"name":"year","label":"Year","type":"text","required":true}]'),

(2, 'references', 'References',
'\\section{References}\n{{#entries}}\n\\textbf{ {{name}} }\\\\\n{{title}}, {{affiliation}}\\\\\n{{email}}\n{{/entries}}',
7, 0, 1,
'[{"name":"name","label":"Name","type":"text","required":true},{"name":"title","label":"Title","type":"text"},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email"}]');

-- Detailed Template Sections
INSERT IGNORE INTO template_sections (template_id, section_key, display_name, latex_code, section_order, is_required, is_repeatable, fields_schema)
VALUES
(3, 'personal_info', 'Personal Information',
'\\begin{center}\n{\\LARGE\\bfseries {{full_name}}}\\\\[4pt]\n{{title}}\\\\[2pt]\n{{email}} | {{phone}}\n\\end{center}',
1, 1, 0,
'[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"title","label":"Title","type":"text"},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email","required":true},{"name":"phone","label":"Phone","type":"text"},{"name":"website","label":"Website","type":"url"},{"name":"orcid","label":"ORCID ID","type":"text"}]'),

(3, 'education', 'Education',
'\\section{Education}\n{{#entries}}\n\\textbf{ {{degree}} } \\hfill {{year_start}}--{{year_end}}\\\\\n{{institution}}\n{{/entries}}',
2, 0, 1,
'[{"name":"degree","label":"Degree","type":"text","required":true},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text"},{"name":"gpa","label":"GPA","type":"text"}]'),

(3, 'experience', 'Work Experience',
'\\section{Experience}\n{{#entries}}\n\\textbf{ {{position}} } \\hfill {{year_start}}--{{year_end}}\\\\\n{{organization}}\\\\\n{{description}}\n{{/entries}}',
3, 0, 1,
'[{"name":"position","label":"Position","type":"text","required":true},{"name":"organization","label":"Organization","type":"text","required":true},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text"},{"name":"description","label":"Description","type":"textarea"}]'),

(3, 'publications', 'Publications',
'\\section{Publications}\n\\begin{enumerate}\n{{#entries}}\n\\item {{authors}} ({{year}}). {{title}}. \\textit{ {{venue}} }.\n{{/entries}}\n\\end{enumerate}',
4, 0, 1,
'[{"name":"title","label":"Title","type":"text","required":true},{"name":"authors","label":"Authors","type":"text","required":true},{"name":"year","label":"Year","type":"text","required":true},{"name":"venue","label":"Journal/Conference","type":"text"},{"name":"doi","label":"DOI","type":"text"}]'),

(3, 'skills', 'Skills',
'\\section{Skills}\n{{#entries}}\n\\textbf{ {{category}} }: {{skills}}\\\\\n{{/entries}}',
5, 0, 1,
'[{"name":"category","label":"Category","type":"text","required":true},{"name":"skills","label":"Skills","type":"text","required":true}]'),

(3, 'awards', 'Awards & Honors',
'\\section{Awards}\n{{#entries}}\n\\textbf{ {{title}} } \\hfill {{year}}\\\\\n{{organization}}\n{{/entries}}',
6, 0, 1,
'[{"name":"title","label":"Award Title","type":"text","required":true},{"name":"organization","label":"Organization","type":"text"},{"name":"year","label":"Year","type":"text","required":true}]'),

(3, 'references', 'References',
'\\section{References}\n{{#entries}}\n\\textbf{ {{name}} }\\\\\n{{title}}, {{affiliation}}\\\\\n{{email}}\n{{/entries}}',
7, 0, 1,
'[{"name":"name","label":"Name","type":"text","required":true},{"name":"title","label":"Title","type":"text"},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email"}]');
