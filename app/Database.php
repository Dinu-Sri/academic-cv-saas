<?php
/**
 * Database Connection (Singleton)
 */
class Database
{
    private static ?Database $instance = null;
    private PDO $connection;

    private function __construct()
    {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;

        try {
            $this->connection = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            if (APP_DEBUG) {
                die("Database connection failed: " . $e->getMessage());
            }
            die("Database connection failed. Please try again later.");
        }
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection(): PDO
    {
        return $this->connection;
    }

    // Prevent cloning
    private function __clone() {}
}
