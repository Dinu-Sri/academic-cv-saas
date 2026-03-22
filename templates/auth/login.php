<?php
$pageTitle = 'Login';
ob_start();
?>
<div class="min-vh-100 d-flex align-items-center auth-page">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-5">
                <div class="text-center mb-4">
                    <img src="<?= APP_URL ?>/assets/images/logo-main.webp" alt="<?= APP_NAME ?>" class="auth-logo mb-3">
                    <p class="auth-tagline"><?= APP_TAGLINE ?></p>
                </div>

                <div class="card shadow-sm">
                    <div class="card-body p-4">
                        <h4 class="card-title mb-4">Sign In</h4>
                        
                        <?= flash_messages() ?>

                        <form method="POST" action="<?= APP_URL ?>/login">
                            <?= Auth::csrfField() ?>

                            <div class="mb-3">
                                <label for="email" class="form-label">Email address</label>
                                <input type="email" class="form-control" id="email" name="email" 
                                       required autofocus placeholder="you@university.edu">
                            </div>

                            <div class="mb-3">
                                <label for="password" class="form-label">Password</label>
                                <input type="password" class="form-control" id="password" name="password" 
                                       required placeholder="••••••••">
                            </div>

                            <button type="submit" class="btn btn-primary w-100 py-2">
                                <i class="bi bi-box-arrow-in-right me-2"></i>Sign In
                            </button>
                        </form>
                    </div>
                </div>

                <p class="text-center mt-3">
                    Don't have an account? 
                    <a href="<?= APP_URL ?>/register" class="fw-semibold">Create one</a>
                </p>
            </div>
        </div>
    </div>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
