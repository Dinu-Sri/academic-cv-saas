<?php
/**
 * CVScholar Database Migration Runner
 * Run inside the app container:
 *   docker exec -it cvscholar-app php migrations/migrate.php
 *
 * Applies .sql files from migrations/ in order, tracks what's been applied.
 * Safe for production — never drops user data.
 */

// Bootstrap
define('BASE_PATH', dirname(__DIR__));
define('APP_PATH', BASE_PATH . '/app');
define('TEMPLATE_PATH', BASE_PATH . '/templates');
define('STORAGE_PATH', BASE_PATH . '/storage');
define('PUBLIC_PATH', BASE_PATH . '/public');

require_once APP_PATH . '/config.php';
require_once APP_PATH . '/Database.php';

$db = Database::getInstance()->getConnection();

// Create migrations tracking table if not exists
$db->exec("
    CREATE TABLE IF NOT EXISTS _migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
");

// Get already-applied migrations
$applied = [];
$stmt = $db->query("SELECT filename FROM _migrations ORDER BY filename");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $applied[] = $row['filename'];
}

// Find pending migration files
$migrationDir = __DIR__;
$files = glob($migrationDir . '/*.sql');
sort($files);

$pending = [];
foreach ($files as $file) {
    $name = basename($file);
    if (!in_array($name, $applied)) {
        $pending[] = $file;
    }
}

if (empty($pending)) {
    echo "✓ Database is up to date. No pending migrations.\n";
    exit(0);
}

echo "Found " . count($pending) . " pending migration(s):\n";

foreach ($pending as $file) {
    $name = basename($file);
    echo "  Applying: {$name} ... ";

    $sql = file_get_contents($file);
    if (empty(trim($sql))) {
        echo "SKIP (empty)\n";
        continue;
    }

    try {
        // Execute multi-statement SQL (no transaction wrapper —
        // MySQL auto-commits DDL statements like CREATE TABLE, ALTER TABLE)
        $db->exec($sql);

        // Record migration
        $stmt = $db->prepare("INSERT INTO _migrations (filename) VALUES (?)");
        $stmt->execute([$name]);

        echo "OK\n";
    } catch (PDOException $e) {
        echo "FAILED\n";
        echo "  Error: " . $e->getMessage() . "\n";
        echo "  Migration halted. Fix the issue and re-run.\n";
        exit(1);
    }
}

echo "✓ All migrations applied successfully.\n";
