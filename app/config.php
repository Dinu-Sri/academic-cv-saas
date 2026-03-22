<?php
/**
 * Application Configuration
 */

// Database Configuration (env vars for Docker, defaults for XAMPP)
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'academic_cv');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');          // XAMPP default
define('DB_CHARSET', 'utf8mb4');

// Application
define('APP_NAME', 'CVScholar');
define('APP_TAGLINE', 'Where Scholars Shine.');
define('APP_URL', getenv('APP_URL') ?: 'http://localhost/academic-cv-saas/public');
define('APP_ENV', getenv('APP_ENV') ?: 'development'); // development | production
define('APP_DEBUG', getenv('APP_DEBUG') !== 'false');

// Security
define('JWT_SECRET', 'change-this-to-a-random-64-char-string-in-production');
define('CSRF_TOKEN_NAME', '_token');
define('PASSWORD_MIN_LENGTH', 8);

// File paths
define('UPLOAD_DIR', STORAGE_PATH . '/uploads');
define('GENERATED_DIR', STORAGE_PATH . '/generated');
define('LOG_DIR', STORAGE_PATH . '/logs');
define('LATEX_TEMPLATES_DIR', BASE_PATH . '/latex_templates');

// LaTeX
define('LATEX_COMPILER', 'pdflatex');
define('LATEX_COMPILE_TIMEOUT', 30);
define('LATEX_TEMP_DIR', STORAGE_PATH . '/temp');

// Upload limits
define('MAX_UPLOAD_SIZE_MB', 10);

// Session
define('SESSION_LIFETIME', 7200); // 2 hours

// Pagination
define('ITEMS_PER_PAGE', 12);

// Feature flags
define('ENABLE_GOOGLE_SCHOLAR', false);
define('ENABLE_ORCID', false);
define('ENABLE_AI_CHAT', false);
define('ENABLE_PAYMENTS', false);
define('ENABLE_GOOGLE_LOGIN', (bool)(getenv('GOOGLE_CLIENT_ID')));

// Google OAuth
define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: '');
define('GOOGLE_CLIENT_SECRET', getenv('GOOGLE_CLIENT_SECRET') ?: '');
define('GOOGLE_REDIRECT_URI', APP_URL . '/auth/google/callback');

// Subscription plans
define('PLAN_FREE_MAX_CVS', 2);
define('PLAN_FREE_MAX_TEMPLATES', 3);
define('PLAN_PRO_MAX_CVS', 20);
define('PLAN_PRO_MAX_TEMPLATES', 999);
