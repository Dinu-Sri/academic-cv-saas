<?php
/**
 * Authentication Helper
 */
class Auth
{
    /**
     * Check if user is logged in
     */
    public static function check(): bool
    {
        return isset($_SESSION['user_id']);
    }

    /**
     * Get current user ID
     */
    public static function id(): ?int
    {
        return $_SESSION['user_id'] ?? null;
    }

    /**
     * Get current user data
     */
    public static function user(): ?array
    {
        if (!self::check()) {
            return null;
        }

        $db = Database::getInstance()->getConnection();
        $stmt = $db->prepare("SELECT id, email, username, full_name, title, affiliation, subscription_plan, is_active, is_admin, orcid_id, google_scholar_id, google_id, avatar_url, auth_provider FROM users WHERE id = ?");
        $stmt->execute([self::id()]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Login user
     */
    public static function login(int $userId): void
    {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        $_SESSION['login_time'] = time();
    }

    /**
     * Logout user
     */
    public static function logout(): void
    {
        $_SESSION = [];
        session_destroy();
    }

    /**
     * Require authentication - redirect if not logged in
     */
    public static function requireLogin(): void
    {
        if (!self::check()) {
            $_SESSION['flash_error'] = 'Please log in to continue.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }
    }

    /**
     * Require admin access - redirect if not admin
     */
    public static function requireAdmin(): void
    {
        self::requireLogin();
        $user = self::user();
        if (!$user || !$user['is_admin']) {
            $_SESSION['flash_error'] = 'Access denied.';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }
    }

    /**
     * Hash password
     */
    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    /**
     * Verify password
     */
    public static function verifyPassword(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    /**
     * Generate CSRF token
     */
    public static function generateToken(): string
    {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    /**
     * Verify CSRF token
     */
    public static function verifyToken(string $token): bool
    {
        return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
    }

    /**
     * Get CSRF hidden input
     */
    public static function csrfField(): string
    {
        return '<input type="hidden" name="' . CSRF_TOKEN_NAME . '" value="' . self::generateToken() . '">';
    }
}
