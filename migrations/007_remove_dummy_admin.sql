-- Migration 007: Remove dummy admin user
DELETE FROM users WHERE email = 'admin@academic-cv.com' AND id = 1;
