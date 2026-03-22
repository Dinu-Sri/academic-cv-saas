<?php
$pageTitle = 'Register';
ob_start();
?>
<div class="min-vh-100 d-flex align-items-center auth-page">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-6">
                <div class="text-center mb-4">
                    <img src="<?= APP_URL ?>/assets/images/logo-main.webp" alt="<?= APP_NAME ?>" class="auth-logo mb-3">
                    <p class="auth-tagline"><?= APP_TAGLINE ?></p>
                </div>

                <div class="card shadow-sm">
                    <div class="card-body p-4">
                        <h4 class="card-title mb-4">Sign Up</h4>

                        <?= flash_messages() ?>

                        <form method="POST" action="<?= APP_URL ?>/register">
                            <?= Auth::csrfField() ?>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="full_name" class="form-label">Full Name</label>
                                    <input type="text" class="form-control" id="full_name" name="full_name"
                                           value="<?= old('full_name') ?>" placeholder="Dr. Jane Smith">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="username" class="form-label">Username *</label>
                                    <input type="text" class="form-control" id="username" name="username"
                                           value="<?= old('username') ?>" required placeholder="janesmith"
                                           pattern="[a-zA-Z0-9_]+" minlength="3">
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="email" class="form-label">Email address *</label>
                                <input type="email" class="form-control" id="email" name="email"
                                       value="<?= old('email') ?>" required placeholder="jane@university.edu">
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="password" class="form-label">Password *</label>
                                    <input type="password" class="form-control" id="password" name="password"
                                           required minlength="<?= PASSWORD_MIN_LENGTH ?>" placeholder="Min <?= PASSWORD_MIN_LENGTH ?> characters">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="password_confirm" class="form-label">Confirm Password *</label>
                                    <input type="password" class="form-control" id="password_confirm" name="password_confirm"
                                           required placeholder="Repeat password">
                                </div>
                            </div>

                            <button type="submit" class="btn btn-primary w-100 py-2">
                                <i class="bi bi-person-plus me-2"></i>Create Account
                            </button>
                        </form>

                        <?php if (ENABLE_GOOGLE_LOGIN): ?>
                        <div class="d-flex align-items-center my-3">
                            <hr class="flex-grow-1"><span class="px-3 text-muted small">or</span><hr class="flex-grow-1">
                        </div>
                        <a href="<?= APP_URL ?>/auth/google" class="btn btn-outline-dark w-100 py-2 d-flex align-items-center justify-content-center">
                            <svg width="18" height="18" viewBox="0 0 48 48" class="me-2"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                            Sign up with Google
                        </a>
                        <?php endif; ?>
                    </div>
                </div>

                <p class="text-center mt-3">
                    Already have an account?
                    <a href="<?= APP_URL ?>/login" class="fw-semibold">Sign In</a>
                </p>
            </div>
        </div>
    </div>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
