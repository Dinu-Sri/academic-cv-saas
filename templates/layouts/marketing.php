<?php require_once APP_PATH . '/helpers.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Primary Meta -->
    <title><?= e($metaTitle ?? 'Academic CV Builder for Researchers') ?> | <?= APP_NAME ?></title>
    <meta name="description" content="<?= e($metaDescription ?? 'Build professional academic CVs rendered through a real LaTeX engine. ORCID & Google Scholar import, 18+ academic sections, free forever. The CV builder researchers trust.') ?>">
    <?php if (!empty($canonicalUrl)): ?>
    <link rel="canonical" href="<?= e($canonicalUrl) ?>">
    <?php endif; ?>

    <!-- Open Graph -->
    <meta property="og:type" content="<?= $ogType ?? 'website' ?>">
    <meta property="og:title" content="<?= e($metaTitle ?? APP_NAME . ' — Academic CV Builder') ?>">
    <meta property="og:description" content="<?= e($metaDescription ?? 'Build professional academic CVs rendered through a real LaTeX engine, with ORCID import and 18+ academic sections.') ?>">
    <meta property="og:url" content="<?= e($canonicalUrl ?? APP_URL) ?>">
    <meta property="og:image" content="<?= e($ogImage ?? APP_URL . '/assets/images/cvscholar-logo.svg') ?>">
    <meta property="og:site_name" content="<?= APP_NAME ?>">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?= e($metaTitle ?? APP_NAME . ' — Academic CV Builder') ?>">
    <meta name="twitter:description" content="<?= e($metaDescription ?? 'Build professional academic CVs rendered through a real LaTeX engine, with ORCID import and 18+ academic sections.') ?>">
    <meta name="twitter:image" content="<?= e($ogImage ?? APP_URL . '/assets/images/cvscholar-logo.svg') ?>">

    <!-- Search Console Verification -->
    <?php if (SEARCH_CONSOLE_VERIFICATION): ?>
    <meta name="google-site-verification" content="<?= e(SEARCH_CONSOLE_VERIFICATION) ?>">
    <?php endif; ?>

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="<?= APP_URL ?>/assets/images/cvscholar-logo.svg">

    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <!-- Google Fonts (Inter) -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- Shared + Marketing CSS -->
    <link href="<?= APP_URL ?>/assets/css/style.css" rel="stylesheet">
    <link href="<?= APP_URL ?>/assets/css/marketing.css" rel="stylesheet">

    <!-- Google Analytics (GA4) -->
    <?php if (GOOGLE_ANALYTICS_ID): ?>
    <script async src="https://www.googletagmanager.com/gtag/js?id=<?= e(GOOGLE_ANALYTICS_ID) ?>"></script>
    <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '<?= e(GOOGLE_ANALYTICS_ID) ?>');
    </script>
    <?php endif; ?>

    <!-- Microsoft Clarity -->
    <script type="text/javascript">
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "wmxf7kusaj");
    </script>

    <!-- Structured Data -->
    <?= $structuredData ?? '' ?>
</head>
<body>

<!-- Marketing Navbar -->
<nav class="navbar navbar-expand-lg mk-navbar sticky-top">
    <div class="container">
        <a class="navbar-brand" href="<?= APP_URL ?>/">
            <img src="<?= APP_URL ?>/assets/images/cvscholar-logo.svg" alt="<?= APP_NAME ?>" height="34">
        </a>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#mkNav" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="mkNav">
            <ul class="navbar-nav mx-auto">
                <li class="nav-item"><a class="nav-link <?= ($activeNav ?? '') === 'home' ? 'active' : '' ?>" href="<?= APP_URL ?>/">Home</a></li>
                <li class="nav-item"><a class="nav-link <?= ($activeNav ?? '') === 'pricing' ? 'active' : '' ?>" href="<?= APP_URL ?>/pricing">Pricing</a></li>
                <li class="nav-item"><a class="nav-link <?= ($activeNav ?? '') === 'blog' ? 'active' : '' ?>" href="<?= APP_URL ?>/blog">Blog</a></li>
                <li class="nav-item"><a class="nav-link <?= ($activeNav ?? '') === 'contact' ? 'active' : '' ?>" href="<?= APP_URL ?>/contact">Contact</a></li>
            </ul>
            <div class="d-flex gap-2 mt-3 mt-lg-0">
                <a href="<?= APP_URL ?>/login" class="btn mk-cta-login btn-sm">Log In</a>
                <a href="<?= APP_URL ?>/register" class="btn mk-cta-start btn-sm">Start Free</a>
            </div>
        </div>
    </div>
</nav>

<!-- Flash Messages (for contact form etc.) -->
<?php if (!empty($_SESSION['flash_success']) || !empty($_SESSION['flash_error'])): ?>
<div class="container mt-3">
    <?= flash_messages() ?>
</div>
<?php endif; ?>

<!-- Page Content -->
<main>
    <?= $content ?? '' ?>
</main>

<!-- Marketing Footer -->
<footer class="mk-footer">
    <div class="container">
        <div class="row g-4">
            <!-- Brand -->
            <div class="col-lg-4 col-md-6">
                <img src="<?= APP_URL ?>/assets/images/cvscholar-logo.svg" alt="<?= APP_NAME ?>" height="30" class="mb-3">
                <p class="small mb-3"><?= APP_TAGLINE ?> The academic CV builder trusted by researchers, professors, and PhD students worldwide.</p>
                <div>
                    <a href="#" class="social-icon" title="Facebook" aria-label="Facebook"><i class="bi bi-facebook"></i></a>
                    <a href="#" class="social-icon" title="YouTube" aria-label="YouTube"><i class="bi bi-youtube"></i></a>
                    <a href="#" class="social-icon" title="Instagram" aria-label="Instagram"><i class="bi bi-instagram"></i></a>
                </div>
            </div>
            <!-- Product -->
            <div class="col-lg-2 col-md-6 col-6">
                <h6>Product</h6>
                <ul class="mk-footer-links">
                    <li><a href="<?= APP_URL ?>/pricing">Pricing</a></li>
                    <li><a href="<?= APP_URL ?>/register">Get Started</a></li>
                    <li><a href="<?= APP_URL ?>/login">Log In</a></li>
                </ul>
            </div>
            <!-- Resources -->
            <div class="col-lg-2 col-md-6 col-6">
                <h6>Resources</h6>
                <ul class="mk-footer-links">
                    <li><a href="<?= APP_URL ?>/blog">Blog</a></li>
                    <li><a href="<?= APP_URL ?>/contact">Contact Us</a></li>
                </ul>
            </div>
            <!-- Legal -->
            <div class="col-lg-2 col-md-6 col-6">
                <h6>Legal</h6>
                <ul class="mk-footer-links">
                    <li><a href="<?= APP_URL ?>/privacy">Privacy Policy</a></li>
                    <li><a href="<?= APP_URL ?>/terms">Terms of Use</a></li>
                    <li><a href="<?= APP_URL ?>/refund-policy">Refund Policy</a></li>
                    <li><a href="<?= APP_URL ?>/cookie-policy">Cookie Policy</a></li>
                    <li><a href="javascript:void(0)" onclick="document.dispatchEvent(new Event('cvscholar:cookie:show'))">Cookie Settings</a></li>
                </ul>
            </div>
            <!-- Contact -->
            <div class="col-lg-2 col-md-6 col-6">
                <h6>Contact</h6>
                <ul class="mk-footer-links">
                    <li><a href="mailto:info@clossyan.com">info@clossyan.com</a></li>
                </ul>
            </div>
        </div>
        <div class="mk-footer-bottom d-flex flex-column flex-md-row justify-content-between align-items-center">
            <span>&copy; <?= date('Y') ?> Clossyan Technologies (Pvt) Ltd. All rights reserved.</span>
            <span class="mt-2 mt-md-0"><?= APP_NAME ?> — <?= APP_TAGLINE ?></span>
        </div>
    </div>
</footer>

<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

<!-- Navbar scroll effect -->
<script>
(function(){
    var nav = document.querySelector('.mk-navbar');
    if (!nav) return;
    window.addEventListener('scroll', function(){
        nav.classList.toggle('scrolled', window.scrollY > 10);
    });
})();
</script>

<?php if (!empty($extraJs)): ?>
    <?= $extraJs ?>
<?php endif; ?>

<?php include TEMPLATE_PATH . '/components/cookie-consent.php'; ?>

</body>
</html>
