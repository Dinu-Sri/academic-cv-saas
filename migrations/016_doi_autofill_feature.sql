-- Migration: Add DOI autofill feature flag
-- This adds the doi_autofill feature as a Pro-only feature

INSERT IGNORE INTO features (feature_key, feature_name, description, category, value_type, sort_order)
VALUES ('doi_autofill', 'DOI Auto-Fill Publications', 'Auto-fill publication fields from DOI using CrossRef API', 'tools', 'boolean', 60);

-- Enable for pro and enterprise only
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES ('free', 'doi_autofill', 0);
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES ('pro', 'doi_autofill', 1);
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES ('enterprise', 'doi_autofill', 1);
