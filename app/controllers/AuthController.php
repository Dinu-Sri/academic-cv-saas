<?php
/**
 * Authentication Controller
 */
class AuthController
{
    private User $userModel;

    public function __construct()
    {
        $this->userModel = new User();
    }

    public function showLogin(): void
    {
        if (Auth::check()) {
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }
        include TEMPLATE_PATH . '/auth/login.php';
    }

    public function showRegister(): void
    {
        if (Auth::check()) {
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }
        include TEMPLATE_PATH . '/auth/register.php';
    }

    public function login(): void
    {
        // Verify CSRF
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid request. Please try again.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        // Validate
        if (empty($email) || empty($password)) {
            $_SESSION['flash_error'] = 'Email and password are required.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        // Find user
        $user = $this->userModel->findByEmail($email);

        if (!$user || !Auth::verifyPassword($password, $user['hashed_password'])) {
            $_SESSION['flash_error'] = 'Invalid email or password.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        if (!$user['is_active']) {
            $_SESSION['flash_error'] = 'Your account has been deactivated.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        // Login
        Auth::login($user['id']);
        $this->userModel->updateLastLogin($user['id']);

        $_SESSION['flash_success'] = 'Welcome back, ' . htmlspecialchars($user['full_name'] ?: $user['username']) . '!';
        header('Location: ' . APP_URL . '/dashboard');
        exit;
    }

    public function register(): void
    {
        // Verify CSRF
        if (!Auth::verifyToken($_POST[CSRF_TOKEN_NAME] ?? '')) {
            $_SESSION['flash_error'] = 'Invalid request. Please try again.';
            header('Location: ' . APP_URL . '/register');
            exit;
        }

        $email = trim($_POST['email'] ?? '');
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $passwordConfirm = $_POST['password_confirm'] ?? '';
        $fullName = trim($_POST['full_name'] ?? '');

        // Validate
        $errors = [];

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Please enter a valid email address.';
        }

        if (empty($username) || strlen($username) < 3 || !preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
            $errors[] = 'Username must be at least 3 characters (letters, numbers, underscores only).';
        }

        if (strlen($password) < PASSWORD_MIN_LENGTH) {
            $errors[] = 'Password must be at least ' . PASSWORD_MIN_LENGTH . ' characters.';
        }

        if ($password !== $passwordConfirm) {
            $errors[] = 'Passwords do not match.';
        }

        // Check uniqueness
        if ($this->userModel->findByEmail($email)) {
            $errors[] = 'An account with this email already exists.';
        }

        if ($this->userModel->findByUsername($username)) {
            $errors[] = 'This username is already taken.';
        }

        if (!empty($errors)) {
            $_SESSION['flash_error'] = implode('<br>', $errors);
            $_SESSION['old_input'] = ['email' => $email, 'username' => $username, 'full_name' => $fullName];
            header('Location: ' . APP_URL . '/register');
            exit;
        }

        // Create user
        $userId = $this->userModel->create([
            'email'     => $email,
            'username'  => $username,
            'password'  => $password,
            'full_name' => $fullName,
        ]);

        // Auto login
        Auth::login($userId);

        $_SESSION['flash_success'] = 'Account created successfully! Welcome to Academic CV.';
        header('Location: ' . APP_URL . '/dashboard');
        exit;
    }

    public function logout(): void
    {
        Auth::logout();
        session_start();
        $_SESSION['flash_success'] = 'You have been logged out.';
        header('Location: ' . APP_URL . '/login');
        exit;
    }

    /**
     * Redirect to Google OAuth
     */
    public function googleRedirect(): void
    {
        if (!ENABLE_GOOGLE_LOGIN) {
            $_SESSION['flash_error'] = 'Google login is not configured.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        $google = new GoogleAuthService();
        header('Location: ' . $google->getAuthUrl());
        exit;
    }

    /**
     * Handle Google OAuth callback
     */
    public function googleCallback(): void
    {
        if (!ENABLE_GOOGLE_LOGIN) {
            $_SESSION['flash_error'] = 'Google login is not configured.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        $google = new GoogleAuthService();

        // Verify state parameter (CSRF protection)
        $state = $_GET['state'] ?? '';
        if (!$google->verifyState($state)) {
            $_SESSION['flash_error'] = 'Invalid request. Please try again.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        // Check for errors from Google
        if (isset($_GET['error'])) {
            $_SESSION['flash_error'] = 'Google login was cancelled.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        $code = $_GET['code'] ?? '';
        if (empty($code)) {
            $_SESSION['flash_error'] = 'No authorization code received.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        // Exchange code for token
        $tokenData = $google->getAccessToken($code);
        if (!$tokenData || !isset($tokenData['access_token'])) {
            $_SESSION['flash_error'] = 'Failed to authenticate with Google.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        // Get user info from Google
        $googleUser = $google->getUserInfo($tokenData['access_token']);
        if (!$googleUser || !isset($googleUser['email'])) {
            $_SESSION['flash_error'] = 'Failed to get user info from Google.';
            header('Location: ' . APP_URL . '/login');
            exit;
        }

        $this->handleGoogleUser($googleUser);
    }

    /**
     * Find or create user from Google data, handling account linking
     */
    private function handleGoogleUser(array $googleUser): void
    {
        $googleId = $googleUser['id'];
        $email = $googleUser['email'];
        $fullName = $googleUser['name'] ?? '';
        $avatarUrl = $googleUser['picture'] ?? null;

        // 1. Check if we already have this Google ID linked
        $user = $this->userModel->findByGoogleId($googleId);
        if ($user) {
            Auth::login($user['id']);
            $this->userModel->updateLastLogin($user['id']);
            $_SESSION['flash_success'] = 'Welcome back, ' . htmlspecialchars($user['full_name'] ?: $user['username']) . '!';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        // 2. Check if a user with this email already exists (link accounts)
        $user = $this->userModel->findByEmail($email);
        if ($user) {
            // Link Google ID to existing account
            $this->userModel->linkGoogleAccount($user['id'], $googleId, $avatarUrl);
            Auth::login($user['id']);
            $this->userModel->updateLastLogin($user['id']);
            $_SESSION['flash_success'] = 'Google account linked! Welcome back, ' . htmlspecialchars($user['full_name'] ?: $user['username']) . '!';
            header('Location: ' . APP_URL . '/dashboard');
            exit;
        }

        // 3. New user — create account
        $username = $this->generateUniqueUsername($email, $fullName);
        $userId = $this->userModel->createFromGoogle([
            'email'      => $email,
            'username'   => $username,
            'full_name'  => $fullName,
            'google_id'  => $googleId,
            'avatar_url' => $avatarUrl,
        ]);

        Auth::login($userId);
        $_SESSION['flash_success'] = 'Account created with Google! Welcome to CVScholar.';
        header('Location: ' . APP_URL . '/dashboard');
        exit;
    }

    /**
     * Generate a unique username from email or name
     */
    private function generateUniqueUsername(string $email, string $fullName): string
    {
        // Try name-based username first
        $base = $fullName ? preg_replace('/[^a-zA-Z0-9]/', '', strtolower($fullName)) : '';
        if (strlen($base) < 3) {
            $base = strstr($email, '@', true);
            $base = preg_replace('/[^a-zA-Z0-9_]/', '', $base);
        }
        $base = substr($base, 0, 20);

        $username = $base;
        $counter = 1;
        while ($this->userModel->findByUsername($username)) {
            $username = $base . $counter;
            $counter++;
        }

        return $username;
    }
}
