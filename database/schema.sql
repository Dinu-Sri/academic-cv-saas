-- Academic CV SaaS - Database Schema
-- Run this in phpMyAdmin or MySQL CLI

CREATE DATABASE IF NOT EXISTS academic_cv CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE academic_cv;

-- =============================================
-- USERS
-- =============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    title VARCHAR(100),           -- Dr., Prof., etc.
    affiliation VARCHAR(255),     -- University/Institution
    personal_info JSON DEFAULT NULL, -- Master personal info (shared across CVs)
    is_active TINYINT(1) DEFAULT 1,
    is_admin TINYINT(1) DEFAULT 0,
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_expires_at DATETIME NULL,
    google_scholar_id VARCHAR(255) NULL,
    orcid_id VARCHAR(255) NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB;

-- =============================================
-- TEMPLATES
-- =============================================
CREATE TABLE templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    preview_image VARCHAR(500),
    latex_header TEXT NOT NULL,     -- LaTeX preamble/packages
    latex_footer TEXT NOT NULL,     -- LaTeX end document
    is_premium TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    style_config JSON,             -- colors, fonts, margins
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- TEMPLATE SECTIONS (defines what sections a template supports)
-- =============================================
CREATE TABLE template_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL,
    section_key VARCHAR(100) NOT NULL,    -- e.g. 'education', 'experience'
    display_name VARCHAR(100) NOT NULL,
    latex_code TEXT NOT NULL,             -- LaTeX snippet with {{placeholders}}
    section_order INT DEFAULT 0,
    is_required TINYINT(1) DEFAULT 0,
    is_repeatable TINYINT(1) DEFAULT 1,  -- Can have multiple entries
    fields_schema JSON NOT NULL,          -- Defines form fields for this section

    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    UNIQUE KEY unique_template_section (template_id, section_key),
    INDEX idx_template (template_id)
) ENGINE=InnoDB;

-- =============================================
-- CV PROFILES
-- =============================================
CREATE TABLE cv_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    template_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,          -- "My Academic CV", "Job Application CV"
    is_default TINYINT(1) DEFAULT 0,
    personal_info JSON,                  -- name, email, phone, address, website, etc.
    last_compiled_at DATETIME NULL,
    pdf_path VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates(id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- =============================================
-- CV SECTIONS (user's actual CV data)
-- =============================================
CREATE TABLE cv_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    section_key VARCHAR(100) NOT NULL,   -- matches template_sections.section_key
    section_order INT DEFAULT 0,
    is_visible TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (profile_id) REFERENCES cv_profiles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_profile_section (profile_id, section_key),
    INDEX idx_profile (profile_id)
) ENGINE=InnoDB;

-- =============================================
-- CV ENTRIES (individual items within a section)
-- =============================================
CREATE TABLE cv_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    section_id INT NOT NULL,
    user_entry_id INT NULL,              -- Links to master user_entries
    entry_order INT DEFAULT 0,
    data JSON NOT NULL,                  -- Flexible data matching fields_schema
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (section_id) REFERENCES cv_sections(id) ON DELETE CASCADE,
    INDEX idx_section (section_id),
    INDEX idx_user_entry (user_entry_id)
) ENGINE=InnoDB;

-- =============================================
-- USER ENTRIES (master copy of entries shared across CVs)
-- =============================================
CREATE TABLE user_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    section_key VARCHAR(100) NOT NULL,
    entry_order INT DEFAULT 0,
    data JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_section (user_id, section_key)
) ENGINE=InnoDB;

-- =============================================
-- PUBLICATIONS (from Scholar/ORCID/manual)
-- =============================================
CREATE TABLE publications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    authors TEXT,
    year INT,
    venue VARCHAR(500),
    doi VARCHAR(255),
    url VARCHAR(500),
    citation_count INT DEFAULT 0,
    source VARCHAR(50) DEFAULT 'manual',  -- google_scholar, orcid, manual
    external_id VARCHAR(255),
    is_verified TINYINT(1) DEFAULT 0,
    is_included TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_source (source)
) ENGINE=InnoDB;

-- =============================================
-- PAYMENTS
-- =============================================
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    subscription_plan VARCHAR(50),
    subscription_months INT DEFAULT 1,
    gateway_response JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- =============================================
-- SYNC LOGS
-- =============================================
CREATE TABLE sync_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    items_synced INT DEFAULT 0,
    error_message TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- =============================================
-- CV SHARES (public sharing links)
-- =============================================
CREATE TABLE cv_shares (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    user_id INT NOT NULL,
    share_slug VARCHAR(100) NOT NULL UNIQUE,
    is_active TINYINT(1) DEFAULT 1,
    view_count INT DEFAULT 0,
    last_viewed_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (profile_id) REFERENCES cv_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_profile_share (profile_id),
    INDEX idx_slug (share_slug),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- =============================================
-- INSERT DEFAULT TEMPLATES
-- =============================================

-- Classic Academic Template
INSERT INTO templates (name, slug, description, latex_header, latex_footer, is_premium, style_config) VALUES
('Classic Academic', 'classic', 'Traditional academic CV with clean typography and structured sections.',
'\\documentclass[11pt,a4paper]{article}
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
'\\end{document}',
0,
'{"primaryColor": "#003366", "fontFamily": "lmodern", "fontSize": "11pt", "margins": "1in"}');

-- Modern Template
INSERT INTO templates (name, slug, description, latex_header, latex_footer, is_premium, style_config) VALUES
('Modern Professional', 'modern', 'Contemporary design with accent colors and a sidebar layout.',
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
0,
'{"primaryColor": "#0077B5", "fontFamily": "raleway", "fontSize": "11pt", "margins": "0.75in"}');

-- Detailed Academic Template
INSERT INTO templates (name, slug, description, latex_header, latex_footer, is_premium, style_config) VALUES
('Detailed Academic', 'detailed', 'Comprehensive template for senior academics with publication lists and grants.',
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
0,
'{"primaryColor": "#660000", "fontFamily": "ebgaramond", "fontSize": "10pt", "margins": "0.9in"}');

-- =============================================
-- INSERT TEMPLATE SECTIONS FOR CLASSIC TEMPLATE
-- =============================================
SET @classic_id = (SELECT id FROM templates WHERE slug = 'classic');

INSERT INTO template_sections (template_id, section_key, display_name, latex_code, section_order, is_required, is_repeatable, fields_schema) VALUES
(@classic_id, 'personal_info', 'Personal Information', 
'\\begin{center}
{\\LARGE\\bfseries {{full_name}}}\\\\[4pt]
{{title}}{{#affiliation}}, {{affiliation}}{{/affiliation}}\\\\[2pt]
{{email}} {{#phone}}\\quad|\\quad {{phone}}{{/phone}}\\\\
{{#website}}\\url{ {{website}} }{{/website}} {{#orcid}}\\quad|\\quad ORCID: {{orcid}}{{/orcid}}
\\end{center}\\vspace{8pt}',
1, 1, 0,
'[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"title","label":"Title","type":"text","placeholder":"Dr., Prof."},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email","required":true},{"name":"phone","label":"Phone","type":"text"},{"name":"address","label":"Address","type":"textarea"},{"name":"website","label":"Website","type":"url"},{"name":"orcid","label":"ORCID ID","type":"text"}]'),

(@classic_id, 'education', 'Education',
'\\section{Education}
\\begin{itemize}[leftmargin=0pt, label={}]
{{#entries}}
\\item \\textbf{ {{degree}} } \\hfill {{year_start}}--{{year_end}}\\\\
{{institution}} {{#location}}\\hfill {{location}}{{/location}}\\\\
{{#thesis}}\\textit{Thesis: {{thesis}} }{{/thesis}}
{{/entries}}
\\end{itemize}',
2, 0, 1,
'[{"name":"degree","label":"Degree","type":"text","required":true,"placeholder":"Ph.D. in Physics"},{"name":"institution","label":"Institution","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"thesis","label":"Thesis Title","type":"text"},{"name":"gpa","label":"GPA","type":"text"}]'),

(@classic_id, 'experience', 'Work Experience',
'\\section{Work Experience}
\\begin{itemize}[leftmargin=0pt, label={}]
{{#entries}}
\\item \\textbf{ {{position}} } \\hfill {{year_start}}--{{year_end}}\\\\
{{organization}} {{#location}}\\hfill {{location}}{{/location}}\\\\
{{#description}}{{description}}{{/description}}
{{/entries}}
\\end{itemize}',
3, 0, 1,
'[{"name":"position","label":"Position","type":"text","required":true},{"name":"organization","label":"Organization","type":"text","required":true},{"name":"location","label":"Location","type":"text"},{"name":"year_start","label":"Start Year","type":"text","required":true},{"name":"year_end","label":"End Year","type":"text","placeholder":"Present"},{"name":"description","label":"Description","type":"textarea"}]'),

(@classic_id, 'publications', 'Publications',
'\\section{Publications}
\\begin{enumerate}[leftmargin=*]
{{#entries}}
\\item {{authors}} ({{year}}). \\textit{ {{title}} }. {{venue}}.{{#doi}} DOI: {{doi}}{{/doi}}
{{/entries}}
\\end{enumerate}',
4, 0, 1,
'[{"name":"title","label":"Title","type":"text","required":true},{"name":"authors","label":"Authors","type":"text","required":true},{"name":"year","label":"Year","type":"text","required":true},{"name":"venue","label":"Journal/Conference","type":"text"},{"name":"doi","label":"DOI","type":"text"},{"name":"url","label":"URL","type":"url"}]'),

(@classic_id, 'skills', 'Skills',
'\\section{Skills}
\\begin{itemize}[leftmargin=*]
{{#entries}}
\\item \\textbf{ {{category}} }: {{skills}}
{{/entries}}
\\end{itemize}',
5, 0, 1,
'[{"name":"category","label":"Category","type":"text","required":true,"placeholder":"Programming Languages"},{"name":"skills","label":"Skills","type":"text","required":true,"placeholder":"Python, MATLAB, C++"}]'),

(@classic_id, 'awards', 'Awards & Honors',
'\\section{Awards \\& Honors}
\\begin{itemize}[leftmargin=*]
{{#entries}}
\\item \\textbf{ {{title}} } {{#organization}}-- {{organization}}{{/organization}} \\hfill {{year}}
{{/entries}}
\\end{itemize}',
6, 0, 1,
'[{"name":"title","label":"Award Title","type":"text","required":true},{"name":"organization","label":"Organization","type":"text"},{"name":"year","label":"Year","type":"text","required":true},{"name":"description","label":"Description","type":"textarea"}]'),

(@classic_id, 'references', 'References',
'\\section{References}
\\begin{itemize}[leftmargin=0pt, label={}]
{{#entries}}
\\item \\textbf{ {{name}} }\\\\
{{title}}, {{affiliation}}\\\\
{{email}} {{#phone}}\\quad|\\quad {{phone}}{{/phone}}
{{/entries}}
\\end{itemize}',
7, 0, 1,
'[{"name":"name","label":"Name","type":"text","required":true},{"name":"title","label":"Title","type":"text"},{"name":"affiliation","label":"Affiliation","type":"text"},{"name":"email","label":"Email","type":"email"},{"name":"phone","label":"Phone","type":"text"}]');
