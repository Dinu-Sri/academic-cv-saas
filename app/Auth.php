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
        $stmt = $db->prepare("SELECT id, email, username, full_name, title, affiliation, subscription_plan, subscription_expires_at, is_active, is_admin, orcid_id, google_scholar_id, google_id, avatar_url, auth_provider FROM users WHERE id = ?");
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

        try {
            $db = Database::getInstance()->getConnection();
            $device = self::detectDevice($_SERVER['HTTP_USER_AGENT'] ?? '');
            $ua     = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);
            $stmt = $db->prepare("UPDATE users SET last_login_at = NOW(), last_device = ?, last_device_ua = ? WHERE id = ?");
            $stmt->execute([$device, $ua, $userId]);
        } catch (\Throwable $e) {
            // Login should still proceed even if this update fails.
        }

        // Fetch user details to enrich the login event and PostHog profile
        $userRow = [];
        try {
            $db = Database::getInstance()->getConnection();
            $stmt = $db->prepare('SELECT email, full_name, subscription_plan FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([$userId]);
            $userRow = $stmt->fetch() ?: [];
        } catch (\Throwable $e) {}

        EventLogger::log('logged_in', ['plan' => $userRow['subscription_plan'] ?? 'free']);

        // $identify so PostHog person profile gets email & plan
        if (defined('POSTHOG_ENABLED') && POSTHOG_ENABLED && !empty($userRow['email'])) {
            EventLogger::identifyInPostHog($userId, [
                'email' => $userRow['email'],
                'name'  => $userRow['full_name'] ?? '',
                'plan'  => $userRow['subscription_plan'] ?? 'free',
            ]);
        }
    }

    /**
     * Classify the current request's device as 'mobile', 'tablet', or 'desktop'
     * based on the User-Agent header. Public wrapper around detectDevice().
     */
    public static function deviceType(): string
    {
        return self::detectDevice($_SERVER['HTTP_USER_AGENT'] ?? '');
    }

    /**
     * Classify a user-agent string into 'mobile', 'tablet', or 'desktop'.
     */
    private static function detectDevice(string $ua): string
    {
        if (preg_match('/tablet|ipad|playbook|silk/i', $ua)) {
            return 'tablet';
        }
        if (preg_match('/mobi|android|iphone|ipod|blackberry|opera mini|windows phone/i', $ua)) {
            return 'mobile';
        }
        return 'desktop';
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
            $accept = strtolower((string)($_SERVER['HTTP_ACCEPT'] ?? ''));
            $xhr = strtolower((string)($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'xmlhttprequest';
            $isJsonRequest = $xhr
                || str_contains($accept, 'application/json')
                || str_contains(strtolower((string)($_SERVER['CONTENT_TYPE'] ?? '')), 'application/json');

            if ($isJsonRequest) {
                http_response_code(401);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Please log in to continue.']);
                exit;
            }

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
