-- Fix European Formal template slug to match feature_key convention
UPDATE templates SET slug = 'european-formal' WHERE slug = 'european-formal-academic';
