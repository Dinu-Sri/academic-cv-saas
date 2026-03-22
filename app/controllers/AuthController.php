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
}
