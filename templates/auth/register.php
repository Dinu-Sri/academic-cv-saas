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
