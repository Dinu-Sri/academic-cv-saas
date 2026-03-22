<?php
$pageTitle = 'Page Not Found';
ob_start();
?>
<div class="container py-5 text-center">
    <h1 class="display-1 fw-bold text-muted">404</h1>
    <h3 class="mb-3">Page Not Found</h3>
    <p class="text-muted mb-4">The page you're looking for doesn't exist.</p>
    <a href="<?= APP_URL ?>/dashboard" class="btn btn-primary">
        <i class="bi bi-house me-1"></i>Go to Dashboard
    </a>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
