<?php
/**
 * Academic CV SaaS - Entry Point
 * All requests are routed through this file.
 */

session_start();

// Trust Cloudflare / reverse-proxy headers (X-Forwarded-Proto, X-Forwarded-For)
if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $_SERVER['HTTPS'] = 'on';
    $_SERVER['SERVER_PORT'] = 443;
}

// Error reporting based on environment
if (getenv('APP_ENV') === 'production') {
    error_reporting(0);
    ini_set('display_errors', 0);
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

// Define base paths
define('BASE_PATH', dirname(__DIR__));
define('APP_PATH', BASE_PATH . '/app');
define('TEMPLATE_PATH', BASE_PATH . '/templates');
define('STORAGE_PATH', BASE_PATH . '/storage');
define('PUBLIC_PATH', __DIR__);

// Autoload classes
spl_autoload_register(function ($class) {
    // Convert namespace to file path
    $paths = [
        APP_PATH . '/' . $class . '.php',
        APP_PATH . '/controllers/' . $class . '.php',
        APP_PATH . '/models/' . $class . '.php',
        APP_PATH . '/services/' . $class . '.php',
        APP_PATH . '/contracts/' . $class . '.php',
    ];
    
    foreach ($paths as $path) {
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

// Load .env file for local development (XAMPP)
$envFile = BASE_PATH . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (!getenv($key)) {
            putenv("$key=$value");
        }
    }
}

// Load configuration
require_once APP_PATH . '/config.php';
require_once APP_PATH . '/helpers.php';

if (APP_ENV === 'production') {
    if (!is_dir(LOG_DIR)) {
        @mkdir(LOG_DIR, 0775, true);
    }

    $logRuntimeError = static function (string $level, string $message, string $file, int $line): void {
        $logFile = LOG_DIR . '/error-' . date('Y-m-d') . '.log';
        $entry = sprintf(
            "[%s] [%s] %s in %s:%d\n",
            date('Y-m-d H:i:s'),
            $level,
            $message,
            $file,
            $line
        );
        @file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
    };

    set_error_handler(static function (int $severity, string $message, string $file, int $line) use ($logRuntimeError): bool {
        $logRuntimeError('ERROR', $message, $file, $line);
        return true;
    });

    set_exception_handler(static function (Throwable $exception) use ($logRuntimeError): void {
        $logRuntimeError('EXCEPTION', $exception->getMessage(), $exception->getFile(), $exception->getLine());
        http_response_code(500);
        echo 'Something went wrong.';
        exit;
    });

    register_shutdown_function(static function () use ($logRuntimeError): void {
        $error = error_get_last();
        if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            $logRuntimeError('FATAL', $error['message'], $error['file'], (int) $error['line']);
        }
    });
}

// Initialize database
$db = Database::getInstance()->getConnection();

// Route the request
$router = new Router();

// Marketing / public routes
$router->get('/', 'MarketingController@home');
$router->get('/pricing', 'MarketingController@pricing');
$router->get('/contact', 'MarketingController@contact');
$router->post('/contact', 'MarketingController@contactSubmit');
$router->get('/privacy', 'MarketingController@privacy');
$router->get('/terms', 'MarketingController@terms');
$router->get('/refund-policy', 'MarketingController@refundPolicy');
$router->get('/demo/template/{id}', 'MarketingController@templateDemo');

// Blog routes
$router->get('/blog', 'BlogController@archive');
$router->get('/blog/category/{category}', 'BlogController@category');
$router->get('/blog/tag/{tag}', 'BlogController@tag');
$router->get('/blog/{slug}', 'BlogController@post');

// SEO routes
$router->get('/sitemap.xml', 'SitemapController@sitemap');
$router->get('/robots.txt', 'SitemapController@robots');
$router->get('/llms.txt', 'SitemapController@llmsTxt');

// Auth routes
$router->get('/login', 'AuthController@showLogin');
$router->post('/login', 'AuthController@login');
$router->get('/register', 'AuthController@showRegister');
$router->post('/register', 'AuthController@register');
$router->get('/logout', 'AuthController@logout');

// Google OAuth
$router->get('/auth/google', 'AuthController@googleRedirect');
$router->get('/auth/google/callback', 'AuthController@googleCallback');

// Dashboard
$router->get('/dashboard', 'DashboardController@index');

// CV routes
$router->get('/cv/create', 'CVController@create');
$router->post('/cv/store', 'CVController@store');
$router->get('/cv/edit/{id}', 'CVController@edit');
$router->post('/cv/update/{id}', 'CVController@update');
$router->post('/cv/delete/{id}', 'CVController@delete');
$router->post('/cv/duplicate/{id}', 'CVController@duplicate');
$router->get('/cv/preview/{id}', 'CVController@preview');
$router->get('/cv/preview-data/{id}', 'CVController@previewData');
$router->get('/cv/download/{id}', 'CVController@download');
$router->post('/cv/compile/{id}', 'CVController@compile');

// CV Section routes (AJAX)
$router->post('/cv/{id}/section/add', 'CVController@addSection');
$router->post('/cv/{id}/section/update', 'CVController@updateSection');
$router->post('/cv/{id}/section/delete', 'CVController@deleteSection');
$router->post('/cv/{id}/section/reorder', 'CVController@reorderSections');
$router->post('/cv/{id}/sections/reorder', 'CVController@reorderSectionOrder');
$router->post('/cv/{id}/settings', 'CVController@saveSettings');

// Template routes
$router->get('/templates', 'TemplateController@gallery');
$router->get('/templates/preview/{id}', 'TemplateController@preview');
$router->get('/templates/demo/{id}', 'TemplateController@demo');

// Profile Import routes
$router->get('/profile/import', 'ProfileImportController@index');
$router->post('/profile/import/orcid', 'ProfileImportController@importOrcid');
$router->post('/profile/import/scholar', 'ProfileImportController@importScholar');
$router->post('/profile/import/approve', 'ProfileImportController@approvePublications');
$router->post('/profile/import/reject', 'ProfileImportController@rejectPublications');
$router->post('/profile/import/apply', 'ProfileImportController@applyProfile');
$router->get('/profile/import/pending', 'ProfileImportController@getPending');

// Settings routes
$router->get('/settings', 'SettingsController@index');
$router->post('/settings/update', 'SettingsController@update');

// Plan routes
$router->get('/plans', 'PlanController@index');
$router->get('/plans/checkout/{plan}', 'PlanController@checkout');

// Payment routes (PayHere)
$router->post('/api/payment/hash', 'PaymentController@generateHash');
$router->get('/api/payment/status', 'PaymentController@status');
$router->post('/payment/notify', 'PaymentController@notify');
$router->get('/payment/success', 'PaymentController@success');
$router->get('/payment/cancel', 'PaymentController@cancel');

// Support ticket routes (user)
$router->get('/support', 'TicketController@index');
$router->post('/support/store', 'TicketController@store');
$router->get('/support/view', 'TicketController@view');
$router->post('/support/reply', 'TicketController@reply');
$router->get('/api/support/unread', 'TicketController@unreadCount');
$router->get('/support/attachment', 'TicketController@attachment');

// Admin routes
$router->get('/admin', 'AdminController@dashboard');
$router->get('/admin/retention', 'AdminController@retention');
$router->get('/admin/users', 'AdminController@users');
$router->get('/admin/users/cvs', 'AdminController@userCvs');
$router->get('/admin/users/cv/preview/{id}', 'AdminController@previewUserCv');
$router->get('/admin/users/cv/pdf/{id}', 'AdminController@previewUserCvPdf');
$router->post('/admin/users/cv/compile', 'AdminController@compileUserCv');
$router->post('/admin/users/update-plan', 'AdminController@updateUserPlan');
$router->post('/admin/users/toggle-status', 'AdminController@toggleUserStatus');
$router->get('/admin/features', 'AdminController@features');
$router->post('/admin/features/update', 'AdminController@updateFeatures');
$router->get('/admin/settings', 'AdminController@settings');
$router->post('/admin/settings/update', 'AdminController@updateSettings');
$router->post('/admin/settings/generate-analytics-key', 'AdminController@generateAnalyticsApiKey');
$router->get('/admin/payments', 'AdminController@payments');
$router->post('/admin/payments/refund', 'AdminController@refund');
$router->post('/admin/payments/approve', 'AdminController@approvePayment');
$router->get('/admin/emails', 'AdminController@emails');
$router->post('/admin/emails/test', 'AdminController@testEmail');
$router->post('/admin/emails/campaign', 'AdminController@sendCampaignEmail');
$router->get('/admin/crons', 'AdminController@crons');
$router->post('/admin/crons/toggle', 'AdminController@toggleCron');
$router->get('/admin/whatsapp', 'AdminController@whatsapp');
$router->post('/admin/whatsapp/update', 'AdminController@updateWhatsapp');
$router->get('/admin/behavior', 'AdminController@behaviorAnalytics');
$router->post('/admin/behavior/export', 'AdminController@behaviorExport');
$router->get('/admin/tickets', 'TicketController@adminIndex');
$router->get('/admin/tickets/view', 'TicketController@adminView');
$router->post('/admin/tickets/reply', 'TicketController@adminReply');
$router->post('/admin/tickets/status', 'TicketController@adminUpdateStatus');

// CV Sharing routes (AJAX)
$router->post('/cv/share/{id}', 'ShareController@create');
$router->post('/cv/share/toggle/{id}', 'ShareController@toggle');
$router->get('/cv/share/info/{id}', 'ShareController@info');

// Public share routes (no auth)
$router->get('/s/{slug}', 'ShareController@view');
$router->get('/s/{slug}/pdf', 'ShareController@servePdf');

// API routes (for AJAX)
$router->post('/api/cv/autosave', 'CVController@autosave');
$router->get('/api/cv/{id}/latex', 'CVController@getLatex');
$router->post('/api/doi/lookup', 'CVController@doiLookup');
$router->post('/api/behavior/track', 'BehaviorController@track');
$router->post('/api/events/log', 'EventsController@log');
$router->get('/api/analytics/{dataset}', 'AnalyticsController@export');

// Dispatch
$router->dispatch();
