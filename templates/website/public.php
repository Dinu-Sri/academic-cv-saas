<?php
/**
 * Public academic website — standalone, mobile-first, one page.
 *
 * Expected vars:
 *   $site        array  view-model from WebsiteDataBuilder::build()
 *   $isPreview   bool   true when the owner is previewing a draft
 *   $templateKey string 'elegant' | 'minimal' | 'bold'
 *   $headline    string optional headline override
 *   $publicUrl   string canonical URL
 *   $status      string 'draft' | 'published'
 *   $website     array  website row (has slug)
 *
 * No external app chrome — this is a self-contained public page.
 */
if (!isset($site) || !is_array($site)) {
    $site = ['personal' => [], 'summary' => '', 'sections' => [], 'publications' => [], 'download' => ['available' => false], 'contact_enabled' => false];
}
$p = $site['personal'] ?? [];
$themeClass = 'theme-' . preg_replace('/[^a-z]/', '', strtolower((string) ($templateKey ?? 'elegant')));
$fullName   = trim((string) ($p['full_name'] ?? '')) ?: 'Academic Profile';
$roleLine   = trim((string) ($p['title'] ?? ''));
$affiliation = trim((string) ($p['affiliation'] ?? ''));
$displayHeadline = trim((string) ($headline ?? ''));
$slug = (string) ($website['slug'] ?? '');
$avatarUrl = trim((string) ($p['avatar_url'] ?? ''));
$hasAvatar = $avatarUrl !== '' && filter_var($avatarUrl, FILTER_VALIDATE_URL) !== false;

$contactFlash = $_SESSION['website_contact_flash'] ?? null;
unset($_SESSION['website_contact_flash']);
$contactParam = $_GET['contact'] ?? '';

$initials = '';
foreach (preg_split('/\s+/', $fullName) as $word) {
    if ($word !== '' && strlen($initials) < 2) {
        $initials .= mb_strtoupper(mb_substr($word, 0, 1));
    }
}

$metaDesc = $roleLine !== '' && $affiliation !== ''
    ? $roleLine . ' at ' . $affiliation
    : ($affiliation !== '' ? $affiliation : 'Academic profile and publications.');

/** Render a generic profile entry as a heading + supporting lines. */
$renderEntry = static function (array $data): string {
    $titleKeys = ['title', 'degree', 'position', 'role', 'name', 'award', 'institution', 'organization', 'project'];
    $subKeys   = ['institution', 'organization', 'company', 'employer', 'university', 'school', 'venue', 'issuer', 'publisher'];
    $dateKeys  = ['year', 'date', 'period', 'duration'];
    $descKeys  = ['description', 'summary', 'details', 'notes', 'abstract'];

    $pick = static function (array $data, array $keys): string {
        foreach ($keys as $k) {
            if (isset($data[$k]) && trim((string) $data[$k]) !== '') {
                return trim((string) $data[$k]);
            }
        }
        return '';
    };

    $title = $pick($data, $titleKeys);
    $sub   = $pick($data, $subKeys);
    $date  = $pick($data, $dateKeys);
    if ($date === '') {
        $start = trim((string) ($data['start'] ?? $data['start_date'] ?? $data['from'] ?? ''));
        $end   = trim((string) ($data['end'] ?? $data['end_date'] ?? $data['to'] ?? ''));
        if ($start !== '' || $end !== '') {
            $date = trim($start . ($end !== '' ? ' – ' . $end : ($start !== '' ? ' – Present' : '')));
        }
    }
    $desc = $pick($data, $descKeys);

    // Used keys to avoid double-printing in the "other fields" pass.
    $used = array_merge($titleKeys, $subKeys, $dateKeys, $descKeys,
        ['start', 'start_date', 'from', 'end', 'end_date', 'to']);

    $html = '<div class="entry">';
    $html .= '<div class="entry-head">';
    if ($title !== '') {
        $html .= '<h3 class="entry-title">' . e($title) . '</h3>';
    }
    if ($date !== '') {
        $html .= '<span class="entry-date">' . e($date) . '</span>';
    }
    $html .= '</div>';
    if ($sub !== '') {
        $html .= '<div class="entry-sub">' . e($sub) . '</div>';
    }
    if ($desc !== '') {
        $html .= '<p class="entry-desc">' . nl2br(e($desc)) . '</p>';
    }

    // Any remaining text fields not already shown.
    $extra = [];
    foreach ($data as $k => $v) {
        if (in_array($k, $used, true)) {
            continue;
        }
        if (is_string($v) && trim($v) !== '') {
            $extra[] = trim($v);
        }
    }
    if ($title === '' && $sub === '' && $desc === '' && !empty($extra)) {
        $html .= '<p class="entry-desc">' . nl2br(e(implode(' · ', $extra))) . '</p>';
        $extra = [];
    } elseif (!empty($extra)) {
        $html .= '<div class="entry-meta">' . e(implode(' · ', $extra)) . '</div>';
    }

    $html .= '</div>';
    return $html;
};
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($fullName) ?><?= $roleLine !== '' ? ' — ' . e($roleLine) : '' ?></title>

    <meta name="description" content="<?= e($metaDesc) ?>">
    <meta name="author" content="<?= e($fullName) ?>">
    <meta property="og:type" content="profile">
    <meta property="og:title" content="<?= e($fullName . ($roleLine !== '' ? ' — ' . $roleLine : '')) ?>">
    <meta property="og:description" content="<?= e($metaDesc) ?>">
    <meta property="og:url" content="<?= e($publicUrl ?? '') ?>">
    <meta name="twitter:card" content="summary">

    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <style>
        :root {
            --primary: #2B6CB0;
            --navy: #1B2A4A;
            --gold: #E8A817;
            --ink: #1f2933;
            --muted: #6b7280;
            --line: #e5e7eb;
            --bg: #ffffff;
            --surface: #f8fafc;
            --radius: 14px;
            --maxw: 760px;
            --head-font: 'Inter', sans-serif;
            --body-font: 'Inter', sans-serif;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: var(--body-font);
            color: var(--ink);
            background: var(--surface);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }
        a { color: var(--primary); text-decoration: none; }
        a:hover { text-decoration: underline; }
        .wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 20px; }

        /* Hero */
        .hero {
            background: var(--bg);
            border-bottom: 1px solid var(--line);
            padding: 48px 0 40px;
            text-align: center;
        }
        .avatar {
            width: 96px; height: 96px; border-radius: 50%;
            background: var(--primary); color: #fff;
            display: inline-flex; align-items: center; justify-content: center;
            font-size: 36px; font-weight: 700; font-family: var(--head-font);
            margin-bottom: 18px; letter-spacing: 1px;
        }
        .avatar img {
            width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;
        }
        .hero h1 {
            font-family: var(--head-font);
            font-size: clamp(26px, 6vw, 38px);
            font-weight: 700; color: var(--navy); line-height: 1.15;
        }
        .hero .role { font-size: clamp(15px, 4vw, 19px); color: var(--primary); font-weight: 600; margin-top: 8px; }
        .hero .affil { font-size: 15px; color: var(--muted); margin-top: 4px; }
        .hero .headline { font-size: 16px; color: var(--ink); margin-top: 16px; max-width: 560px; margin-left: auto; margin-right: auto; }

        .links { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 22px; }
        .links a {
            display: inline-flex; align-items: center; gap: 7px;
            padding: 8px 15px; border: 1px solid var(--line); border-radius: 999px;
            font-size: 14px; font-weight: 500; color: var(--ink); background: var(--bg);
            transition: all .15s ease;
        }
        .links a:hover { border-color: var(--primary); color: var(--primary); text-decoration: none; transform: translateY(-1px); }
        .cta { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 20px; }
        .btn {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 11px 22px; border-radius: 10px; font-weight: 600; font-size: 15px;
            border: 1px solid transparent; cursor: pointer; transition: all .15s ease;
        }
        .btn-primary { background: var(--primary); color: #fff; }
        .btn-primary:hover { background: #245a96; text-decoration: none; color: #fff; }
        .btn-outline { background: var(--bg); color: var(--ink); border-color: var(--line); }
        .btn-outline:hover { border-color: var(--primary); color: var(--primary); text-decoration: none; }

        /* Sections */
        section.block { padding: 36px 0; }
        section.block + section.block { border-top: 1px solid var(--line); }
        .block h2 {
            font-family: var(--head-font);
            font-size: 13px; text-transform: uppercase; letter-spacing: .12em;
            color: var(--primary); font-weight: 700; margin-bottom: 22px;
            display: flex; align-items: center; gap: 10px;
        }
        .block h2::after { content: ""; flex: 1; height: 1px; background: var(--line); }
        .summary-text { font-size: 16.5px; color: var(--ink); }

        .entry { padding: 14px 0; }
        .entry + .entry { border-top: 1px dashed var(--line); }
        .entry-head { display: flex; justify-content: space-between; gap: 14px; align-items: baseline; flex-wrap: wrap; }
        .entry-title { font-family: var(--head-font); font-size: 16.5px; font-weight: 600; color: var(--navy); }
        .entry-date { font-size: 13px; color: var(--muted); white-space: nowrap; font-weight: 500; }
        .entry-sub { font-size: 15px; color: var(--primary); font-weight: 500; margin-top: 2px; }
        .entry-desc { font-size: 14.5px; color: #4b5563; margin-top: 6px; }
        .entry-meta { font-size: 13.5px; color: var(--muted); margin-top: 6px; }

        /* Publications */
        .pub { padding: 14px 0; }
        .pub + .pub { border-top: 1px dashed var(--line); }
        .pub-title { font-weight: 600; color: var(--navy); font-size: 15.5px; }
        .pub-authors { font-size: 14px; color: #4b5563; margin-top: 3px; }
        .pub-venue { font-size: 14px; color: var(--muted); font-style: italic; margin-top: 3px; }
        .pub-links { margin-top: 6px; display: flex; gap: 14px; flex-wrap: wrap; font-size: 13.5px; }

        /* Contact */
        .contact-card { background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; }
        .form-row { display: flex; gap: 14px; flex-wrap: wrap; }
        .form-group { margin-bottom: 14px; flex: 1; min-width: 200px; }
        .form-group label { display: block; font-size: 13.5px; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
        .form-group input, .form-group textarea {
            width: 100%; padding: 11px 13px; border: 1px solid var(--line); border-radius: 9px;
            font-family: inherit; font-size: 15px; color: var(--ink); background: var(--surface);
        }
        .form-group input:focus, .form-group textarea:focus { outline: none; border-color: var(--primary); background: #fff; }
        .hp { position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; overflow: hidden; }
        .alert { padding: 12px 15px; border-radius: 9px; font-size: 14.5px; margin-bottom: 16px; }
        .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
        .alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

        /* Footer */
        footer { padding: 28px 0 40px; text-align: center; color: var(--muted); font-size: 13.5px; }
        footer a { font-weight: 600; }

        .preview-banner {
            position: sticky; top: 0; z-index: 50;
            background: var(--gold); color: #3a2c00; text-align: center;
            padding: 9px 16px; font-size: 14px; font-weight: 600;
        }

        /* ---- Theme: minimal (cleaner, serif-free, no avatar fill) ---- */
        .theme-minimal { --surface: #ffffff; }
        .theme-minimal .hero { padding: 56px 0 36px; text-align: left; }
        .theme-minimal .links, .theme-minimal .cta { justify-content: flex-start; }
        .theme-minimal .avatar { display: none; }
        .theme-minimal .block h2::after { display: none; }

        /* ---- Theme: bold (strong navy hero, serif headings) ---- */
        .theme-bold { --head-font: 'Lora', serif; }
        .theme-bold .hero { background: var(--navy); color: #fff; border-bottom: none; }
        .theme-bold .hero h1 { color: #fff; }
        .theme-bold .hero .affil { color: #cbd5e1; }
        .theme-bold .hero .headline { color: #e2e8f0; }
        .theme-bold .hero .role { color: var(--gold); }
        .theme-bold .avatar { background: var(--gold); color: var(--navy); }
        .theme-bold .links a { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.25); color: #fff; }
        .theme-bold .links a:hover { background: rgba(255,255,255,.16); color: #fff; border-color: #fff; }

        @media (max-width: 480px) {
            .hero { padding: 36px 0 30px; }
            .cta .btn { width: 100%; justify-content: center; }
        }
    </style>
</head>
<body class="<?= e($themeClass) ?>">

<?php if (!empty($isPreview)): ?>
    <div class="preview-banner">
        <i class="bi bi-eye"></i> Preview —
        <?= ($status ?? 'draft') === 'published' ? 'this site is live' : 'this is a private draft (not yet published)' ?>
    </div>
<?php endif; ?>

<header class="hero">
    <div class="wrap">
        <div class="avatar"><?php if ($hasAvatar): ?><img src="<?= e($avatarUrl) ?>" alt="<?= e($fullName) ?>" referrerpolicy="no-referrer"><?php else: ?><?= e($initials !== '' ? $initials : 'CV') ?><?php endif; ?></div>
        <h1><?= e($fullName) ?></h1>
        <?php if ($roleLine !== ''): ?><div class="role"><?= e($roleLine) ?></div><?php endif; ?>
        <?php if ($affiliation !== ''): ?><div class="affil"><?= e($affiliation) ?></div><?php endif; ?>
        <?php if (!empty($p['location'])): ?><div class="affil"><i class="bi bi-geo-alt"></i> <?= e($p['location']) ?></div><?php endif; ?>
        <?php if ($displayHeadline !== ''): ?><p class="headline"><?= e($displayHeadline) ?></p><?php endif; ?>

        <?php
        $links = $p['links'] ?? [];
        $linkMeta = [
            'website'        => ['bi-globe', 'Website'],
            'linkedin'       => ['bi-linkedin', 'LinkedIn'],
            'orcid'          => ['bi-person-vcard', 'ORCID'],
            'google_scholar' => ['bi-mortarboard', 'Scholar'],
        ];
        if (!empty($links) || !empty($p['email'])): ?>
        <div class="links">
            <?php foreach ($linkMeta as $key => $meta): ?>
                <?php if (!empty($links[$key])):
                    $href = $links[$key];
                    if (!preg_match('~^https?://~i', $href)) {
                        $href = ($key === 'orcid') ? 'https://orcid.org/' . ltrim($href, '/') : 'https://' . $href;
                    } ?>
                    <a href="<?= e($href) ?>" target="_blank" rel="noopener nofollow"><i class="bi <?= e($meta[0]) ?>"></i> <?= e($meta[1]) ?></a>
                <?php endif; ?>
            <?php endforeach; ?>
            <?php if (!empty($p['email'])): ?>
                <a href="mailto:<?= e($p['email']) ?>"><i class="bi bi-envelope"></i> Email</a>
            <?php endif; ?>
            <?php if (!empty($p['phone'])): ?>
                <a href="tel:<?= e(preg_replace('/[^0-9+]/', '', $p['phone'])) ?>"><i class="bi bi-telephone"></i> <?= e($p['phone']) ?></a>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        <?php
        $downloadAvailable = !empty($site['download']['available']);
        $contactEnabled = !empty($site['contact_enabled']);
        if (($downloadAvailable || $contactEnabled) && $slug !== ''): ?>
        <div class="cta">
            <?php if ($downloadAvailable): ?>
                <a class="btn btn-primary" href="<?= e(APP_URL . '/u/' . $slug . '/cv') ?>"><i class="bi bi-download"></i> Download CV</a>
            <?php endif; ?>
            <?php if ($contactEnabled): ?>
                <a class="btn btn-outline" href="#contact"><i class="bi bi-chat-dots"></i> Get in touch</a>
            <?php endif; ?>
        </div>
        <?php endif; ?>
    </div>
</header>

<main>
    <?php if (!empty($site['summary'])): ?>
    <section class="block">
        <div class="wrap">
            <h2>About</h2>
            <p class="summary-text"><?= nl2br(e($site['summary'])) ?></p>
        </div>
    </section>
    <?php endif; ?>

    <?php foreach (($site['sections'] ?? []) as $section): ?>
        <?php if (empty($section['entries'])) continue; ?>
        <section class="block">
            <div class="wrap">
                <h2><?= e($section['label']) ?></h2>
                <?php foreach ($section['entries'] as $entry): ?>
                    <?= $renderEntry(is_array($entry) ? $entry : []) ?>
                <?php endforeach; ?>
            </div>
        </section>
    <?php endforeach; ?>

    <?php if (!empty($site['publications'])): ?>
    <section class="block">
        <div class="wrap">
            <h2>Publications</h2>
            <?php foreach ($site['publications'] as $pub): ?>
                <div class="pub">
                    <?php if (!empty($pub['title'])): ?>
                        <div class="pub-title"><?= e($pub['title']) ?><?= !empty($pub['year']) ? ' (' . e($pub['year']) . ')' : '' ?></div>
                    <?php endif; ?>
                    <?php if (!empty($pub['authors'])): ?><div class="pub-authors"><?= e($pub['authors']) ?></div><?php endif; ?>
                    <?php if (!empty($pub['venue'])): ?><div class="pub-venue"><?= e($pub['venue']) ?></div><?php endif; ?>
                    <?php if (!empty($pub['doi']) || !empty($pub['url'])): ?>
                    <div class="pub-links">
                        <?php if (!empty($pub['doi'])):
                            $doi = $pub['doi'];
                            $doiUrl = preg_match('~^https?://~i', $doi) ? $doi : 'https://doi.org/' . ltrim($doi, '/'); ?>
                            <a href="<?= e($doiUrl) ?>" target="_blank" rel="noopener nofollow"><i class="bi bi-link-45deg"></i> DOI</a>
                        <?php endif; ?>
                        <?php if (!empty($pub['url'])): ?>
                            <a href="<?= e($pub['url']) ?>" target="_blank" rel="noopener nofollow"><i class="bi bi-box-arrow-up-right"></i> Link</a>
                        <?php endif; ?>
                    </div>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

    <?php if (!empty($site['contact_enabled']) && $slug !== ''): ?>
    <section class="block" id="contact">
        <div class="wrap">
            <h2>Contact</h2>
            <?php if ($contactParam === 'success' || ($contactFlash['status'] ?? '') === 'success'): ?>
                <div class="alert alert-success"><i class="bi bi-check-circle"></i> <?= e($contactFlash['message'] ?? 'Thanks! Your message has been sent.') ?></div>
            <?php elseif ($contactParam === 'error' && !empty($contactFlash['message'])): ?>
                <div class="alert alert-error"><i class="bi bi-exclamation-circle"></i> <?= e($contactFlash['message']) ?></div>
            <?php endif; ?>
            <div class="contact-card">
                <?php if (!empty($isPreview)): ?>
                    <p style="color:var(--muted);font-size:14.5px;"><i class="bi bi-info-circle"></i> The contact form is active on your published site. This is a preview.</p>
                <?php else: ?>
                <form method="POST" action="<?= e(APP_URL . '/u/' . $slug . '/contact') ?>" autocomplete="off">
                    <div class="hp" aria-hidden="true">
                        <label>Leave this field empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="visitor_name">Your name</label>
                            <input type="text" id="visitor_name" name="visitor_name" maxlength="150" required>
                        </div>
                        <div class="form-group">
                            <label for="visitor_email">Your email</label>
                            <input type="email" id="visitor_email" name="visitor_email" maxlength="255" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="subject">Subject</label>
                        <input type="text" id="subject" name="subject" maxlength="255">
                    </div>
                    <div class="form-group">
                        <label for="message">Message</label>
                        <textarea id="message" name="message" rows="5" maxlength="5000" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary"><i class="bi bi-send"></i> Send message</button>
                </form>
                <?php endif; ?>
            </div>
        </div>
    </section>
    <?php endif; ?>
</main>

<footer>
    <div class="wrap">
        Academic website powered by
        <a href="<?= e(APP_URL) ?>" target="_blank" rel="noopener"><?= e(defined('APP_NAME') ? APP_NAME : 'CVScholar') ?></a>
    </div>
</footer>

</body>
</html>
