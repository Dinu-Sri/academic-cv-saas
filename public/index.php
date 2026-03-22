<?php
/**
 * Academic CV SaaS - Entry Point
 * All requests are routed through this file.
 */

session_start();

// Error reporting for development
error_reporting(E_ALL);
ini_set('display_errors', 1);

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
    ];
    
    foreach ($paths as $path) {
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

// Load configuration
require_once APP_PATH . '/config.php';
require_once APP_PATH . '/helpers.php';

// Initialize database
$db = Database::getInstance()->getConnection();

// Route the request
$router = new Router();

// Auth routes
$router->get('/', 'AuthController@showLogin');
$router->get('/login', 'AuthController@showLogin');
$router->post('/login', 'AuthController@login');
$router->get('/register', 'AuthController@showRegister');
$router->post('/register', 'AuthController@register');
$router->get('/logout', 'AuthController@logout');

// Dashboard
$router->get('/dashboard', 'DashboardController@index');

// CV routes
$router->get('/cv/create', 'CVController@create');
$router->post('/cv/store', 'CVController@store');
$router->get('/cv/edit/{id}', 'CVController@edit');
$router->post('/cv/update/{id}', 'CVController@update');
$router->post('/cv/delete/{id}', 'CVController@delete');
$router->get('/cv/preview/{id}', 'CVController@preview');
$router->get('/cv/preview-data/{id}', 'CVController@previewData');
$router->get('/cv/download/{id}', 'CVController@download');
$router->post('/cv/compile/{id}', 'CVController@compile');

// CV Section routes (AJAX)
$router->post('/cv/{id}/section/add', 'CVController@addSection');
$router->post('/cv/{id}/section/update', 'CVController@updateSection');
$router->post('/cv/{id}/section/delete', 'CVController@deleteSection');
$router->post('/cv/{id}/section/reorder', 'CVController@reorderSections');

// Template routes
$router->get('/templates', 'TemplateController@gallery');
$router->get('/templates/preview/{id}', 'TemplateController@preview');

// Profile Import routes
$router->get('/profile/import', 'ProfileImportController@index');
$router->post('/profile/import/orcid', 'ProfileImportController@importOrcid');
$router->post('/profile/import/scholar', 'ProfileImportController@importScholar');
$router->post('/profile/import/approve', 'ProfileImportController@approvePublications');
$router->post('/profile/import/reject', 'ProfileImportController@rejectPublications');
$router->post('/profile/import/apply', 'ProfileImportController@applyProfile');
$router->get('/profile/import/pending', 'ProfileImportController@getPending');

// API routes (for AJAX)
$router->post('/api/cv/autosave', 'CVController@autosave');
$router->get('/api/cv/{id}/latex', 'CVController@getLatex');

// Dispatch
$router->dispatch();
