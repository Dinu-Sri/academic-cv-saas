-- Migration 011: Add feature flags for new template sections
-- New sections: research_interests, projects, teaching, supervision, grants,
--   conferences, certifications, languages, professional_memberships, editorial

INSERT IGNORE INTO features (feature_key, feature_name, category, description) VALUES
('section_research_interests', 'Research Interests Section', 'sections', 'Research interests/areas section'),
('section_projects', 'Projects Section', 'sections', 'Research/professional projects section'),
('section_teaching', 'Teaching Experience Section', 'sections', 'Teaching experience section'),
('section_supervision', 'Student Supervision Section', 'sections', 'Student supervision section'),
('section_grants', 'Grants & Funding Section', 'sections', 'Grants and funding section'),
('section_conferences', 'Conference Presentations Section', 'sections', 'Conference presentations section'),
('section_certifications', 'Certifications Section', 'sections', 'Certifications and licenses section'),
('section_languages', 'Languages Section', 'sections', 'Languages section'),
('section_professional_memberships', 'Professional Memberships Section', 'sections', 'Professional memberships section'),
('section_editorial', 'Editorial & Reviewing Section', 'sections', 'Editorial and reviewing section');

-- Free plan: only research_interests and projects
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('free', 'section_research_interests', 1),
('free', 'section_projects', 1),
('free', 'section_teaching', 0),
('free', 'section_supervision', 0),
('free', 'section_grants', 0),
('free', 'section_conferences', 0),
('free', 'section_certifications', 0),
('free', 'section_languages', 0),
('free', 'section_professional_memberships', 0),
('free', 'section_editorial', 0);

-- Pro plan: all sections enabled
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('pro', 'section_research_interests', 1),
('pro', 'section_projects', 1),
('pro', 'section_teaching', 1),
('pro', 'section_supervision', 1),
('pro', 'section_grants', 1),
('pro', 'section_conferences', 1),
('pro', 'section_certifications', 1),
('pro', 'section_languages', 1),
('pro', 'section_professional_memberships', 1),
('pro', 'section_editorial', 1);

-- Enterprise plan: all sections enabled
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('enterprise', 'section_research_interests', 1),
('enterprise', 'section_projects', 1),
('enterprise', 'section_teaching', 1),
('enterprise', 'section_supervision', 1),
('enterprise', 'section_grants', 1),
('enterprise', 'section_conferences', 1),
('enterprise', 'section_certifications', 1),
('enterprise', 'section_languages', 1),
('enterprise', 'section_professional_memberships', 1),
('enterprise', 'section_editorial', 1);
