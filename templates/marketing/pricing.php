<!-- Breadcrumb -->
<div class="container mk-breadcrumb">
    <a href="<?= APP_URL ?>/">Home</a> <span class="mx-2 text-muted">/</span> <span class="text-muted">Pricing</span>
</div>

<section class="mk-section pt-4">
    <div class="container">
        <div class="text-center mb-5">
            <h1 class="mk-section-title">Simple Credit Pricing</h1>
            <p class="mk-section-subtitle">Start free. Buy credits only when you need more PDF compiles or PDF import applies.</p>
        </div>

        <div class="row g-4 justify-content-center align-items-stretch">
            <div class="col-md-6 col-lg-4">
                <div class="mk-pricing-card h-100">
                    <h4 class="fw-bold">Free Starter Credits</h4>
                    <p class="text-muted small mb-3">Included when you create an account</p>
                    <div class="mk-pricing-price">50</div>
                    <div class="mk-pricing-period">credits</div>
                    <ul class="mk-pricing-features">
                        <li><i class="bi bi-check-circle-fill"></i> All templates available</li>
                        <li><i class="bi bi-check-circle-fill"></i> All academic sections</li>
                        <li><i class="bi bi-check-circle-fill"></i> ORCID & Google Scholar imports</li>
                        <li><i class="bi bi-check-circle-fill"></i> Public CV sharing</li>
                        <li><i class="bi bi-check-circle-fill"></i> DOI auto-fill</li>
                    </ul>
                    <a href="<?= APP_URL ?>/register" class="btn btn-outline-primary w-100 fw-semibold">Start Free</a>
                </div>
            </div>

            <div class="col-md-6 col-lg-4">
                <div class="mk-pricing-card featured h-100">
                    <div class="mk-pricing-badge">Stackable</div>
                    <h4 class="fw-bold">Credit Pack</h4>
                    <p class="text-muted small mb-3">One-time purchase</p>
                    <div class="mk-pricing-price">$5</div>
                    <div class="mk-pricing-period">for 250 credits</div>
                    <ul class="mk-pricing-features">
                        <li><i class="bi bi-check-circle-fill"></i> Credits do not expire</li>
                        <li><i class="bi bi-check-circle-fill"></i> Buy multiple packs anytime</li>
                        <li><i class="bi bi-check-circle-fill"></i> 1 credit per successful PDF compile</li>
                        <li><i class="bi bi-check-circle-fill"></i> 3 credits per successful PDF import apply</li>
                        <li><i class="bi bi-check-circle-fill"></i> ORCID & Scholar imports remain free</li>
                    </ul>
                    <a href="<?= APP_URL ?>/register" class="btn btn-primary w-100 fw-semibold">Get Credits</a>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="mk-section mk-section-alt">
    <div class="container" style="max-width: 900px;">
        <h2 class="text-center mk-section-title mb-5">How Credits Work</h2>
        <div class="table-responsive">
            <table class="table table-bordered bg-white rounded overflow-hidden">
                <thead class="table-light">
                    <tr>
                        <th>Action</th>
                        <th class="text-center">Credits Used</th>
                        <th>When charged</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>Compile PDF</td><td class="text-center fw-bold">1</td><td>Only after the PDF compiles successfully</td></tr>
                    <tr><td>Apply PDF import</td><td class="text-center fw-bold">3</td><td>Only after selected imported CV details are applied</td></tr>
                    <tr><td>ORCID import</td><td class="text-center fw-bold">0</td><td>Free</td></tr>
                    <tr><td>Google Scholar import</td><td class="text-center fw-bold">0</td><td>Free</td></tr>
                    <tr><td>Templates, sharing, DOI auto-fill</td><td class="text-center fw-bold">0</td><td>Included</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</section>

<section class="mk-section">
    <div class="container" style="max-width:800px;">
        <h2 class="text-center mk-section-title mb-5">Frequently Asked Questions</h2>
        <div class="accordion" id="pricingFaq">
            <?php foreach ($faqs as $i => $faq): ?>
            <div class="accordion-item border-0 border-bottom">
                <h3 class="accordion-header">
                    <button class="accordion-button <?= $i > 0 ? 'collapsed' : '' ?> fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#faq<?= $i ?>">
                        <?= e($faq['question']) ?>
                    </button>
                </h3>
                <div id="faq<?= $i ?>" class="accordion-collapse collapse <?= $i === 0 ? 'show' : '' ?>" data-bs-parent="#pricingFaq">
                    <div class="accordion-body text-muted"><?= e($faq['answer']) ?></div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<section class="mk-cta-section">
    <div class="container">
        <h2>Start Building Your Academic CV Today</h2>
        <p class="mt-3 mb-4 opacity-75">No subscription. No plan lock. Credits only when work is completed.</p>
        <a href="<?= APP_URL ?>/register" class="btn btn-light btn-lg text-primary fw-bold">
            <i class="bi bi-rocket-takeoff me-2"></i>Create Your Free CV
        </a>
    </div>
</section>
