<?php
$pageTitle = 'Payment Cancelled';
ob_start();
?>
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-lg-6 text-center">

            <div class="card shadow-sm">
                <div class="card-body p-5">
                    <div class="mb-4">
                        <i class="bi bi-x-circle text-muted" style="font-size: 4rem;"></i>
                    </div>
                    <h2 class="fw-bold mb-2">Payment Cancelled</h2>
                    <p class="text-muted mb-4">
                        Your payment was not completed. No charges have been made to your account.
                        You can try again whenever you're ready.
                    </p>
                    <div class="d-flex gap-2 justify-content-center">
                        <a href="<?= APP_URL ?>/plans" class="btn btn-primary">
                            <i class="bi bi-arrow-left me-1"></i>Back to Plans
                        </a>
                        <a href="<?= APP_URL ?>/dashboard" class="btn btn-outline-secondary">
                            Dashboard
                        </a>
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
