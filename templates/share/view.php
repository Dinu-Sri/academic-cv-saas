<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($shareData['full_name']) ?> — Curriculum Vitae</title>

    <!-- Open Graph -->
    <meta property="og:type" content="profile">
    <meta property="og:title" content="<?= e($shareData['og_title']) ?>">
    <meta property="og:description" content="<?= e($shareData['og_description']) ?>">
    <meta property="og:url" content="<?= e(APP_URL . '/s/' . $shareData['share_slug']) ?>">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="<?= e($shareData['og_title']) ?>">
    <meta name="twitter:description" content="<?= e($shareData['og_description']) ?>">

    <!-- Standard meta -->
    <meta name="description" content="<?= e($shareData['og_description']) ?>">
    <meta name="author" content="<?= e($shareData['full_name']) ?>">

    <!-- Minimal styling -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f5f5f5;
            color: #333;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .cv-header {
            background: #fff;
            border-bottom: 1px solid #e0e0e0;
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .cv-header-info h1 {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0;
        }

        .cv-header-info p {
            font-size: 13px;
            color: #666;
            margin: 4px 0 0;
        }

        .cv-header-actions {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .btn-download {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 18px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            transition: all 0.15s;
            border: none;
            cursor: pointer;
        }

        .btn-download-primary {
            background: #003366;
            color: #fff;
        }
        .btn-download-primary:hover {
            background: #002244;
        }

        .cv-viewer {
            flex: 1;
            display: flex;
            justify-content: center;
            padding: 24px;
        }

        .cv-viewer iframe {
            width: 100%;
            max-width: 900px;
            height: calc(100vh - 120px);
            border: none;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            background: #fff;
        }

        @media (max-width: 640px) {
            .cv-header { flex-direction: column; gap: 12px; text-align: center; }
            .cv-viewer { padding: 12px; }
            .cv-viewer iframe { height: calc(100vh - 160px); }
        }
    </style>
</head>
<body>
    <div class="cv-header">
        <div class="cv-header-info">
            <h1><?= e($shareData['full_name']) ?></h1>
            <?php if ($shareData['title'] || $shareData['affiliation']): ?>
            <p>
                <?= e($shareData['title']) ?>
                <?php if ($shareData['title'] && $shareData['affiliation']): ?> · <?php endif; ?>
                <?= e($shareData['affiliation']) ?>
            </p>
            <?php endif; ?>
        </div>
        <div class="cv-header-actions">
            <a href="<?= e($shareData['pdf_url']) ?>" class="btn-download btn-download-primary" download>
                <i class="bi bi-download"></i> Download CV
            </a>
        </div>
    </div>

    <div class="cv-viewer">
        <iframe src="<?= e($shareData['pdf_url']) ?>" title="Curriculum Vitae"></iframe>
    </div>
</body>
</html>
