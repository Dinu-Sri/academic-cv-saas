<?php
$pageTitle = 'Credits';
ob_start();
?>
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-lg-8">
            <div class="text-center mb-4">
                <h2 class="fw-bold mb-2">CVScholar Credits</h2>
                <p class="text-muted fs-5 mb-0">Use credits only when CVScholar does real work for you.</p>
            </div>

            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body p-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                    <div>
                        <div class="text-muted small">Available credits</div>
                        <div class="display-5 fw-bold mb-0"><?= (int) $creditBalance ?></div>
                    </div>
                    <a href="<?= APP_URL ?>/plans/checkout/credits" class="btn btn-primary btn-lg">
                        <i class="bi bi-lightning-charge me-1"></i>Buy 250 Credits for $5
                    </a>
                </div>
            </div>

            <div class="row g-3">
                <div class="col-md-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <div class="fw-semibold mb-1"><i class="bi bi-filetype-pdf text-danger me-1"></i>Compile PDF</div>
                            <div class="text-muted small">1 credit per successful compile.</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <div class="fw-semibold mb-1"><i class="bi bi-file-earmark-arrow-up text-warning me-1"></i>PDF Import Apply</div>
                            <div class="text-muted small">3 credits when imported PDF details are applied.</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <div class="fw-semibold mb-1"><i class="bi bi-journal-check text-success me-1"></i>ORCID & Scholar</div>
                            <div class="text-muted small">Publication profile imports remain free.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
