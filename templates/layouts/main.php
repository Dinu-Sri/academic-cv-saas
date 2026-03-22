<?php require_once APP_PATH . '/helpers.php'; ?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($pageTitle ?? 'Academic CV Builder') ?> - <?= APP_NAME ?></title>
    
    <!-- Favicon -->
    <link rel="icon" type="image/webp" href="<?= APP_URL ?>/assets/images/favicon.webp">
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Custom CSS -->
    <link href="<?= APP_URL ?>/assets/css/style.css" rel="stylesheet">
    <?php if (!empty($extraCss)): ?>
        <?= $extraCss ?>
    <?php endif; ?>
</head>
<body>
    <?php if (Auth::check()): ?>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark navbar-cvscholar sticky-top">
        <div class="container">
            <a class="navbar-brand fw-bold" href="<?= APP_URL ?>/dashboard">
                <img src="<?= APP_URL ?>/assets/images/logo-header.webp" alt="<?= APP_NAME ?>" height="32">
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="mainNav">
                <ul class="navbar-nav me-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="<?= APP_URL ?>/dashboard">
                            <i class="bi bi-grid-1x2 me-1"></i>Dashboard
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="<?= APP_URL ?>/templates">
                            <i class="bi bi-layout-text-window me-1"></i>Templates
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="<?= APP_URL ?>/profile/import">
                            <i class="bi bi-cloud-download me-1"></i>Import
                        </a>
                    </li>
                </ul>
                <ul class="navbar-nav">
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                            <i class="bi bi-person-circle me-1"></i>
                            <?= e(Auth::user()['full_name'] ?: Auth::user()['username']) ?>
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><span class="dropdown-item-text text-muted small">
                                Plan: <?= ucfirst(e(Auth::user()['subscription_plan'])) ?>
                            </span></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item" href="<?= APP_URL ?>/logout">
                                <i class="bi bi-box-arrow-right me-2"></i>Logout
                            </a></li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
    <?php endif; ?>

    <!-- Flash Messages -->
    <div class="container mt-3">
        <?= flash_messages() ?>
    </div>

    <!-- Main Content -->
    <main>
        <?= $content ?? '' ?>
    </main>

    <!-- Footer -->
    <footer class="py-4 mt-5">
        <div class="container text-center">
            <div class="footer-tagline mb-1"><?= APP_TAGLINE ?></div>
            <small>&copy; <?= date('Y') ?> <?= APP_NAME ?>. Built for academics, by academics.</small>
        </div>
    </footer>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <!-- Custom JS -->
    <script src="<?= APP_URL ?>/assets/js/app.js"></script>
    <?php if (!empty($extraJs)): ?>
        <?= $extraJs ?>
    <?php endif; ?>
</body>
</html>
