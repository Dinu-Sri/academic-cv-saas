-- Migration 006: Feature flags system for per-plan feature gating
-- Features table: all toggleable features in the system
-- Plan_features table: which features are enabled for which plans

CREATE TABLE IF NOT EXISTS features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feature_key VARCHAR(100) NOT NULL UNIQUE,
    feature_name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    value_type VARCHAR(20) NOT NULL DEFAULT 'boolean',
    is_active TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plan_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan VARCHAR(50) NOT NULL,
    feature_key VARCHAR(100) NOT NULL,
    is_enabled TINYINT(1) DEFAULT 0,
    config_value VARCHAR(255) NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_plan_feature (plan, feature_key),
    INDEX idx_plan (plan),
    INDEX idx_feature (feature_key)
) ENGINE=InnoDB;

-- Seed default features
INSERT IGNORE INTO features (feature_key, feature_name, description, category, value_type, sort_order) VALUES
('max_cvs', 'Maximum CVs', 'Maximum number of CVs a user can create', 'limits', 'number', 1),
('max_templates', 'Available Templates', 'Number of templates accessible', 'limits', 'number', 2),
('template_classic', 'Classic Template', 'Access to the Classic CV template', 'templates', 'boolean', 10),
('template_modern', 'Modern Template', 'Access to the Modern CV template', 'templates', 'boolean', 11),
('template_detailed', 'Detailed Template', 'Access to the Detailed CV template', 'templates', 'boolean', 12),
('import_orcid', 'ORCID Import', 'Import profile data from ORCID', 'import', 'boolean', 20),
('import_scholar', 'Google Scholar Import', 'Import publications from Google Scholar', 'import', 'boolean', 21),
('pdf_download', 'PDF Download', 'Download CV as PDF', 'core', 'boolean', 30),
('google_signin', 'Google Sign-in', 'Sign in with Google account', 'auth', 'boolean', 31),
('custom_sections', 'Custom Sections', 'Create custom CV sections', 'editor', 'boolean', 40),
('section_education', 'Education Section', 'Education section in CV editor', 'sections', 'boolean', 50),
('section_experience', 'Experience Section', 'Work experience section in CV editor', 'sections', 'boolean', 51),
('section_publications', 'Publications Section', 'Publications section in CV editor', 'sections', 'boolean', 52),
('section_skills', 'Skills Section', 'Skills section in CV editor', 'sections', 'boolean', 53),
('section_awards', 'Awards Section', 'Awards & honors section in CV editor', 'sections', 'boolean', 54),
('section_references', 'References Section', 'References section in CV editor', 'sections', 'boolean', 55),
('priority_pdf', 'Priority PDF Generation', 'Faster PDF compilation queue', 'core', 'boolean', 60),
('priority_support', 'Priority Support', 'Priority email support', 'support', 'boolean', 70);

-- Seed plan_features for Free plan
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('free', 'max_cvs', 1, '2'),
('free', 'max_templates', 1, '3'),
('free', 'template_classic', 1, NULL),
('free', 'template_modern', 1, NULL),
('free', 'template_detailed', 1, NULL),
('free', 'import_orcid', 1, NULL),
('free', 'import_scholar', 1, NULL),
('free', 'pdf_download', 1, NULL),
('free', 'google_signin', 1, NULL),
('free', 'custom_sections', 0, NULL),
('free', 'section_education', 1, NULL),
('free', 'section_experience', 1, NULL),
('free', 'section_publications', 1, NULL),
('free', 'section_skills', 1, NULL),
('free', 'section_awards', 1, NULL),
('free', 'section_references', 1, NULL),
('free', 'priority_pdf', 0, NULL),
('free', 'priority_support', 0, NULL);

-- Seed plan_features for Pro plan
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('pro', 'max_cvs', 1, '20'),
('pro', 'max_templates', 1, '999'),
('pro', 'template_classic', 1, NULL),
('pro', 'template_modern', 1, NULL),
('pro', 'template_detailed', 1, NULL),
('pro', 'import_orcid', 1, NULL),
('pro', 'import_scholar', 1, NULL),
('pro', 'pdf_download', 1, NULL),
('pro', 'google_signin', 1, NULL),
('pro', 'custom_sections', 1, NULL),
('pro', 'section_education', 1, NULL),
('pro', 'section_experience', 1, NULL),
('pro', 'section_publications', 1, NULL),
('pro', 'section_skills', 1, NULL),
('pro', 'section_awards', 1, NULL),
('pro', 'section_references', 1, NULL),
('pro', 'priority_pdf', 1, NULL),
('pro', 'priority_support', 1, NULL);

-- Seed plan_features for Enterprise plan
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('enterprise', 'max_cvs', 1, '999999'),
('enterprise', 'max_templates', 1, '999'),
('enterprise', 'template_classic', 1, NULL),
('enterprise', 'template_modern', 1, NULL),
('enterprise', 'template_detailed', 1, NULL),
('enterprise', 'import_orcid', 1, NULL),
('enterprise', 'import_scholar', 1, NULL),
('enterprise', 'pdf_download', 1, NULL),
('enterprise', 'google_signin', 1, NULL),
('enterprise', 'custom_sections', 1, NULL),
('enterprise', 'section_education', 1, NULL),
('enterprise', 'section_experience', 1, NULL),
('enterprise', 'section_publications', 1, NULL),
('enterprise', 'section_skills', 1, NULL),
('enterprise', 'section_awards', 1, NULL),
('enterprise', 'section_references', 1, NULL),
('enterprise', 'priority_pdf', 1, NULL),
('enterprise', 'priority_support', 1, NULL);

-- Mark super admin
UPDATE users SET is_admin = 1 WHERE email = 'dinu.sri.m@gmail.com';
