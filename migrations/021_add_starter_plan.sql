-- Migration 021: Add Starter plan + update Pro plan limits
-- Starter: $5 one-time, 30 days, same features as Pro
-- Pro: unlimited CVs (was 20)

-- =============================================
-- PART 1: Starter plan — mirror Pro's plan_features
-- =============================================

-- Core limits
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('starter', 'max_cvs', 1, '999999'),
('starter', 'max_templates', 1, '999');

-- Templates (all 6)
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('starter', 'template_classic', 1, NULL),
('starter', 'template_modern', 1, NULL),
('starter', 'template_detailed', 1, NULL),
('starter', 'template_classic_faculty', 1, NULL),
('starter', 'template_european_formal', 1, NULL),
('starter', 'template_research_dossier', 1, NULL);

-- Core features
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('starter', 'import_orcid', 1, NULL),
('starter', 'import_scholar', 1, NULL),
('starter', 'pdf_download', 1, NULL),
('starter', 'google_signin', 1, NULL),
('starter', 'custom_sections', 1, NULL),
('starter', 'priority_pdf', 1, NULL),
('starter', 'priority_support', 1, NULL);

-- Base sections (from migration 006)
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('starter', 'section_education', 1, NULL),
('starter', 'section_experience', 1, NULL),
('starter', 'section_publications', 1, NULL),
('starter', 'section_skills', 1, NULL),
('starter', 'section_awards', 1, NULL),
('starter', 'section_references', 1, NULL);

-- Extended sections (from migration 011)
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('starter', 'section_research_interests', 1, NULL),
('starter', 'section_projects', 1, NULL),
('starter', 'section_teaching', 1, NULL),
('starter', 'section_supervision', 1, NULL),
('starter', 'section_grants', 1, NULL),
('starter', 'section_conferences', 1, NULL),
('starter', 'section_certifications', 1, NULL),
('starter', 'section_languages', 1, NULL),
('starter', 'section_professional_memberships', 1, NULL),
('starter', 'section_editorial', 1, NULL);

-- Pro template sections (from migration 013)
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('starter', 'section_academic_appointments', 1, NULL),
('starter', 'section_research_experience', 1, NULL),
('starter', 'section_academic_service', 1, NULL),
('starter', 'section_invited_talks', 1, NULL),
('starter', 'section_patents', 1, NULL);

-- Academic profile section (from migration 015)
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled, config_value) VALUES
('starter', 'section_academic_profile', 1, NULL);

-- =============================================
-- PART 2: Update Pro plan — unlimited CVs
-- =============================================

UPDATE plan_features SET config_value = '999999' WHERE plan = 'pro' AND feature_key = 'max_cvs';
