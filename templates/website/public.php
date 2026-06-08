<?php
/**
 * Public academic website — standalone, mobile-first, one page (or multi-page).
 *
 * Expected vars:
 *   $site         array   view-model from WebsiteDataBuilder
 *   $isPreview    bool    owner previewing a draft
 *   $templateKey  string  elegant|minimal|bold|scholarly|researcher
 *   $headline     string  optional headline override
 *   $publicUrl    string  canonical URL
 *   $status       string  draft|published
 *   $website      array   website row (has slug)
 *   $siteMode     string  single|multi
 *   $navConfig    array   which pages in nav {about:true, ...}
 *   $currentPage  string  about|publications|teaching|cv|contact
 *   $stats        array   {publications, years, grants}
 *
 * No external app chrome — this is a self-contained public page.
 */
if (!isset($site) || !is_array($site)) {
    $site = ['personal' => [], 'summary' => '', 'sections' => [], 'publications' => [], 'download' => ['available' => false], 'contact_enabled' => false, 'stats' => []];
}
$p        = $site['personal'] ?? [];
$stats    = $site['stats'] ?? ($stats ?? []);
$siteMode = $siteMode ?? 'single';
$navConfig = $navConfig ?? [];
$currentPage = $currentPage ?? 'about';
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
$isMulti = $siteMode === 'multi';
$showNav = $isMulti && !empty($navConfig);

// ── Entry renderers per theme ──────────────────────────────────────────────

/**
 * Theme: Classic — left-border accent cards, solid separators.
 */
$renderEntryClassic = static function (array $data): string {
    $title = $data['title'] ?? $data['degree'] ?? $data['position'] ?? $data['role'] ?? $data['name'] ?? $data['award'] ?? $data['institution'] ?? $data['organization'] ?? $data['project'] ?? $data['category'] ?? '';
    $sub   = $data['institution'] ?? $data['organization'] ?? $data['company'] ?? $data['employer'] ?? $data['university'] ?? $data['school'] ?? $data['venue'] ?? $data['issuer'] ?? $data['publisher'] ?? '';
    $date  = $data['year'] ?? $data['date'] ?? $data['period'] ?? $data['duration'] ?? '';
    if ($date === '') {
        $start = trim((string) ($data['start'] ?? $data['start_date'] ?? $data['from'] ?? ''));
        $end   = trim((string) ($data['end'] ?? $data['end_date'] ?? $data['to'] ?? ''));
        if ($start !== '' || $end !== '') { $date = trim($start . ($end !== '' ? ' – ' . $end : ($start !== '' ? ' – Present' : ''))); }
    }
    $desc  = $data['description'] ?? $data['summary'] ?? $data['details'] ?? $data['notes'] ?? $data['abstract'] ?? ($data['skills'] ?? '');
    $used  = ['title','degree','position','role','name','award','institution','organization','company','employer','university','school','project','venue','issuer','publisher','category','year','date','period','duration','start','start_date','from','end','end_date','to','description','summary','details','notes','abstract','skills'];
    $extra = [];
    foreach ($data as $k => $v) { if (!in_array($k, $used, true) && is_string($v) && trim($v) !== '') { $extra[] = trim($v); } }

    $h = '<div class="entry entry-classic">';
    $h .= '<div class="entry-head">';
    if ($title !== '') { $h .= '<h3 class="entry-title">' . e($title) . '</h3>'; }
    if ($date !== '')  { $h .= '<span class="entry-date">' . e($date) . '</span>'; }
    $h .= '</div>';
    if ($sub !== '')   { $h .= '<div class="entry-sub">' . e($sub) . '</div>'; }
    if ($desc !== '')  { $h .= '<p class="entry-desc">' . nl2br(e($desc)) . '</p>'; }
    if ($title === '' && $sub === '' && $desc === '' && !empty($extra)) {
        $h .= '<p class="entry-desc">' . nl2br(e(implode(' · ', $extra))) . '</p>';
    } elseif (!empty($extra)) {
        $h .= '<div class="entry-meta">' . e(implode(' · ', $extra)) . '</div>';
    }
    $h .= '</div>';
    return $h;
};

/**
 * Theme: Modern — timeline entries, minimal separators.
 */
$renderEntryModern = static function (array $data): string {
    $title = $data['title'] ?? $data['degree'] ?? $data['position'] ?? $data['role'] ?? $data['name'] ?? $data['award'] ?? $data['project'] ?? $data['category'] ?? '';
    $sub   = $data['institution'] ?? $data['organization'] ?? $data['company'] ?? $data['employer'] ?? $data['university'] ?? $data['school'] ?? $data['venue'] ?? $data['issuer'] ?? '';
    $date  = $data['year'] ?? $data['date'] ?? '';
    if ($date === '') {
        $start = trim((string) ($data['start'] ?? $data['from'] ?? ''));
        $end   = trim((string) ($data['end'] ?? $data['to'] ?? ''));
        if ($start !== '' || $end !== '') { $date = trim($start . ($end !== '' ? ' – ' . $end : ($start !== '' ? ' – Present' : ''))); }
    }
    $desc  = $data['description'] ?? $data['summary'] ?? $data['details'] ?? '';
    $used  = ['title','degree','position','role','name','award','project','institution','organization','company','employer','university','school','venue','issuer','year','date','start','from','end','to','description','summary','details'];
    $extra = [];
    foreach ($data as $k => $v) { if (!in_array($k, $used, true) && is_string($v) && trim($v) !== '') { $extra[] = trim($v); } }

    $h = '<div class="entry entry-modern">';
    $h .= '<div class="entry-head">';
    if ($title !== '') {
        $h .= '<span class="entry-title">' . e($title) . '</span>';
        if ($sub !== '') { $h .= ' <span class="entry-sub-inline"> · ' . e($sub) . '</span>'; }
        if ($date !== '') { $h .= ' <span class="entry-date-inline">' . e($date) . '</span>'; }
    } else {
        if ($sub !== '') { $h .= '<span class="entry-title">' . e($sub) . '</span>'; }
        if ($date !== '') { $h .= ' <span class="entry-date-inline">' . e($date) . '</span>'; }
    }
    $h .= '</div>';
    if ($desc !== '')  { $h .= '<p class="entry-desc">' . nl2br(e($desc)) . '</p>'; }
    if (!empty($extra)) { $h .= '<div class="entry-meta">' . e(implode(' · ', $extra)) . '</div>'; }
    $h .= '</div>';
    return $h;
};

/**
 * Theme: Bold — card entries with subtle shadow.
 */
$renderEntryBold = static function (array $data): string {
    $title = $data['title'] ?? $data['degree'] ?? $data['position'] ?? $data['role'] ?? $data['name'] ?? $data['award'] ?? $data['project'] ?? $data['category'] ?? '';
    $sub   = $data['institution'] ?? $data['organization'] ?? $data['company'] ?? $data['employer'] ?? $data['university'] ?? $data['school'] ?? $data['venue'] ?? $data['issuer'] ?? '';
    $date  = $data['year'] ?? $data['date'] ?? '';
    if ($date === '') {
        $start = trim((string) ($data['start'] ?? $data['from'] ?? ''));
        $end   = trim((string) ($data['end'] ?? $data['to'] ?? ''));
        if ($start !== '' || $end !== '') { $date = trim($start . ($end !== '' ? ' – ' . $end : ($start !== '' ? ' – Present' : ''))); }
    }
    $desc  = $data['description'] ?? $data['summary'] ?? $data['details'] ?? '';
    $used  = ['title','degree','position','role','name','award','project','institution','organization','company','employer','university','school','venue','issuer','year','date','start','from','end','to','description','summary','details'];
    $extra = [];
    foreach ($data as $k => $v) { if (!in_array($k, $used, true) && is_string($v) && trim($v) !== '') { $extra[] = trim($v); } }

    $h = '<div class="entry entry-bold">';
    if ($date !== '') { $h .= '<span class="entry-badge">' . e($date) . '</span>'; }
    $h .= '<div class="entry-head">';
    if ($title !== '') { $h .= '<h3 class="entry-title">' . e($title) . '</h3>'; }
    $h .= '</div>';
    if ($sub !== '')   { $h .= '<div class="entry-sub">' . e($sub) . '</div>'; }
    if ($desc !== '')  { $h .= '<p class="entry-desc">' . nl2br(e($desc)) . '</p>'; }
    if (!empty($extra)) { $h .= '<div class="entry-meta">' . e(implode(' · ', $extra)) . '</div>'; }
    $h .= '</div>';
    return $h;
};

/**
 * Theme: Scholarly — bordered cards, rich metadata.
 */
$renderEntryScholarly = static function (array $data): string {
    $title = $data['title'] ?? $data['degree'] ?? $data['position'] ?? $data['role'] ?? $data['name'] ?? $data['award'] ?? $data['project'] ?? $data['category'] ?? '';
    $sub   = $data['institution'] ?? $data['organization'] ?? $data['company'] ?? $data['employer'] ?? $data['university'] ?? $data['school'] ?? $data['venue'] ?? $data['issuer'] ?? '';
    $date  = $data['year'] ?? $data['date'] ?? '';
    if ($date === '') {
        $start = trim((string) ($data['start'] ?? $data['from'] ?? ''));
        $end   = trim((string) ($data['end'] ?? $data['to'] ?? ''));
        if ($start !== '' || $end !== '') { $date = trim($start . ($end !== '' ? ' – ' . $end : ($start !== '' ? ' – Present' : ''))); }
    }
    $desc  = $data['description'] ?? $data['summary'] ?? $data['details'] ?? '';
    $used  = ['title','degree','position','role','name','award','project','institution','organization','company','employer','university','school','venue','issuer','year','date','start','from','end','to','description','summary','details'];
    $extra = [];
    foreach ($data as $k => $v) { if (!in_array($k, $used, true) && is_string($v) && trim($v) !== '') { $extra[] = trim($v); } }

    $h = '<div class="entry entry-scholarly">';
    $h .= '<div class="entry-head">';
    if ($title !== '') { $h .= '<h3 class="entry-title">' . e($title) . '</h3>'; }
    if ($date !== '')  { $h .= '<span class="entry-date">' . e($date) . '</span>'; }
    $h .= '</div>';
    if ($sub !== '')   { $h .= '<div class="entry-sub">' . e($sub) . '</div>'; }
    if ($desc !== '')  { $h .= '<p class="entry-desc">' . nl2br(e($desc)) . '</p>'; }
    if (!empty($extra)) { $h .= '<div class="entry-meta">' . e(implode(' · ', $extra)) . '</div>'; }
    $h .= '</div>';
    return $h;
};

/**
 * Theme: Researcher — pure typography, no cards, generous spacing.
 */
$renderEntryResearcher = static function (array $data): string {
    $title = $data['title'] ?? $data['degree'] ?? $data['position'] ?? $data['role'] ?? $data['name'] ?? $data['award'] ?? $data['project'] ?? $data['category'] ?? '';
    $sub   = $data['institution'] ?? $data['organization'] ?? $data['company'] ?? $data['employer'] ?? $data['university'] ?? $data['school'] ?? $data['venue'] ?? $data['issuer'] ?? '';
    $date  = $data['year'] ?? $data['date'] ?? '';
    if ($date === '') {
        $start = trim((string) ($data['start'] ?? $data['from'] ?? ''));
        $end   = trim((string) ($data['end'] ?? $data['to'] ?? ''));
        if ($start !== '' || $end !== '') { $date = trim($start . ($end !== '' ? ' – ' . $end : ($start !== '' ? ' – Present' : ''))); }
    }
    $desc  = $data['description'] ?? $data['summary'] ?? $data['details'] ?? '';
    $used  = ['title','degree','position','role','name','award','project','institution','organization','company','employer','university','school','venue','issuer','year','date','start','from','end','to','description','summary','details'];
    $extra = [];
    foreach ($data as $k => $v) { if (!in_array($k, $used, true) && is_string($v) && trim($v) !== '') { $extra[] = trim($v); } }

    $h = '<div class="entry entry-researcher">';
    $h .= '<div class="entry-head">';
    if ($title !== '') { $h .= '<span class="entry-title">' . e($title) . '</span>'; }
    if ($sub !== '' || $date !== '') {
        $line2 = [];
        if ($sub !== '')  { $line2[] = e($sub); }
        if ($date !== '') { $line2[] = '<span class="entry-date-muted">' . e($date) . '</span>'; }
        $h .= ' <span class="entry-sub-line">' . implode(' · ', $line2) . '</span>';
    }
    $h .= '</div>';
    if ($desc !== '')  { $h .= '<p class="entry-desc">' . nl2br(e($desc)) . '</p>'; }
    if (!empty($extra)) { $h .= '<div class="entry-meta">' . e(implode(' · ', $extra)) . '</div>'; }
    $h .= '</div>';
    return $h;
};

// Select renderer per theme
$entryRenderer = match ($templateKey) {
    'classic', 'elegant' => $renderEntryClassic,
    'minimal', 'modern'  => $renderEntryModern,
    'bold'               => $renderEntryBold,
    'scholarly'          => $renderEntryScholarly,
    'researcher'         => $renderEntryResearcher,
    default              => $renderEntryClassic,
};

// ── Social link metadata ───────────────────────────────────────────────────
$linkMeta = [
    'website'        => ['bi-globe', 'Website'],
    'linkedin'       => ['bi-linkedin', 'LinkedIn'],
    'orcid'          => ['bi-person-vcard', 'ORCID'],
    'google_scholar' => ['bi-mortarboard', 'Scholar'],
];
$downloadAvailable = !empty($site['download']['available']);
$contactEnabled = !empty($site['contact_enabled']);
$isClassicTheme = in_array((string) ($templateKey ?? ''), ['classic', 'elegant'], true);

// Determine which sections to show based on current page
if ($isMulti) {
    $showAbout     = $currentPage === 'about';
    $showPubs      = $currentPage === 'publications';
    $showTeaching  = $currentPage === 'teaching';
    $showContact   = $currentPage === 'contact';
    $showCvPage    = $currentPage === 'cv';
} else {
    $showAbout = $showPubs = $showContact = true;
    $showTeaching = $showCvPage = false;
}

$classicTocLinks = [];
if ($isClassicTheme && !$isMulti) {
    if (!empty($site['summary'])) {
        $classicTocLinks[] = ['about', 'About'];
    }
    foreach (($site['sections'] ?? []) as $section) {
        if (!empty($section['entries']) && !empty($section['key']) && !empty($section['label'])) {
            $classicTocLinks[] = [(string) $section['key'], (string) $section['label']];
        }
    }
    if (!empty($site['publications'])) {
        $classicTocLinks[] = ['publications', 'Publications'];
    }
    if ($contactEnabled && $slug !== '') {
        $classicTocLinks[] = ['contact', 'Contact'];
    }
}

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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <style>
/* ═══════════════════════════════════════════════════════════════════════════
   SHARED BASE — reset, utilities, forms, footer
   ═══════════════════════════════════════════════════════════════════════════ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{font-family:'Inter',sans-serif;line-height:1.65;color:#1f2933;-webkit-font-smoothing:antialiased;background:#fff}
a{color:inherit;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
a:hover{opacity:.8}
img{max-width:100%;height:auto;display:block}
.wrap{max-width:var(--maxw,760px);margin:0 auto;padding:0 20px}

/* ── Site Navigation (multi-page) ─────────────────────────────────────── */
.site-nav{background:var(--nav-bg,#fff);border-bottom:1px solid var(--nav-border,#e5e7eb);position:sticky;top:0;z-index:100}
.nav-inner{max-width:var(--maxw,960px);margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:52px}
.nav-brand{font-weight:700;font-size:15px;text-decoration:none;color:var(--nav-brand,#1f2933);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.nav-links{display:flex;list-style:none;gap:2px;align-items:center}
.nav-link{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;color:var(--nav-link,#4b5563);transition:all .12s ease}
.nav-link:hover{background:var(--nav-hover,#f3f4f6);color:var(--nav-active,#2563eb);opacity:1}
.nav-link.active{background:var(--nav-active-bg,#eff6ff);color:var(--nav-active,#2563eb);font-weight:600}
.nav-link-icon{font-size:14px}
.nav-toggle{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:6px}
.nav-toggle-bar{width:22px;height:2px;background:var(--nav-brand,#1f2933);border-radius:2px;transition:all .2s ease}

/* ── Hero base ────────────────────────────────────────────────────────── */
.hero{background:var(--hero-bg,#fff);border-bottom:1px solid var(--hero-border,#e5e7eb);padding:48px 0 40px;text-align:center}
.avatar{width:var(--avatar-size,96px);height:var(--avatar-size,96px);border-radius:var(--avatar-radius,50%);background:var(--avatar-bg,#2B6CB0);color:var(--avatar-color,#fff);display:inline-flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;font-family:var(--head-font,'Inter'),sans-serif;margin-bottom:18px;letter-spacing:1px;overflow:hidden}
.avatar img{width:100%;height:100%;object-fit:cover;display:block}
.hero h1{font-family:var(--head-font,'Inter'),sans-serif;font-size:clamp(26px,6vw,38px);font-weight:700;color:var(--hero-name,#1B2A4A);line-height:1.15}
.hero .role{font-size:clamp(15px,4vw,19px);color:var(--hero-role,#2B6CB0);font-weight:600;margin-top:8px}
.hero .affil{font-size:15px;color:var(--hero-affil,#6b7280);margin-top:4px}
.hero .headline{font-size:16px;color:var(--hero-headline,#1f2933);margin-top:16px;max-width:560px;margin-left:auto;margin-right:auto}
.links{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:22px}
.links a{display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border:1px solid var(--link-border,#e5e7eb);border-radius:999px;font-size:14px;font-weight:500;text-decoration:none;color:var(--link-color,#1f2933);background:var(--link-bg,#fff);transition:all .15s ease}
.links a:hover{border-color:var(--link-hover-border,#2B6CB0);color:var(--link-hover-color,#2B6CB0);opacity:1;transform:translateY(-1px)}
.cta{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:10px;font-weight:600;font-size:15px;border:1px solid transparent;cursor:pointer;transition:all .15s ease;text-decoration:none}
.btn-primary{background:var(--btn-primary,#2B6CB0);color:#fff}
.btn-primary:hover{opacity:.9;color:#fff;text-decoration:none}
.btn-outline{background:var(--btn-outline-bg,#fff);color:var(--btn-outline-color,#1f2933);border-color:var(--btn-outline-border,#e5e7eb)}
.btn-outline:hover{border-color:var(--btn-hover-border,#2B6CB0);color:var(--btn-hover-color,#2B6CB0);text-decoration:none}

/* ── Sections base ────────────────────────────────────────────────────── */
section.block{padding:var(--section-padding,36px 0)}
section.block+.block{border-top:var(--section-divider,1px solid #e5e7eb)}
.block h2{font-family:var(--head-font,'Inter'),sans-serif;font-size:var(--section-heading-size,13px);text-transform:var(--section-heading-case,uppercase);letter-spacing:var(--section-heading-spacing,.12em);color:var(--section-heading-color,#2B6CB0);font-weight:700;margin-bottom:22px;display:flex;align-items:center;gap:10px}
.block h2::after{content:var(--section-rule-content,"");flex:1;height:1px;background:var(--section-rule-color,#e5e7eb);display:var(--section-rule-display,block)}
.summary-text{font-size:16.5px;color:var(--summary-color,#1f2933)}

/* ── Entries (theme overrides via custom properties) ──────────────────── */
.entry{padding:var(--entry-padding,14px 0)}
.entry+.entry{border-top:var(--entry-divider,1px dashed #e5e7eb)}
.entry-head{display:flex;justify-content:space-between;gap:14px;align-items:baseline;flex-wrap:wrap}
.entry-title{font-family:var(--head-font,'Inter'),sans-serif;font-size:16.5px;font-weight:600;color:var(--entry-title-color,#1B2A4A)}
.entry-date{font-size:13px;color:var(--entry-date-color,#6b7280);white-space:nowrap;font-weight:500}
.entry-sub{font-size:15px;color:var(--entry-sub-color,#2B6CB0);font-weight:500;margin-top:2px}
.entry-desc{font-size:14.5px;color:var(--entry-desc-color,#4b5563);margin-top:6px}
.entry-meta{font-size:13.5px;color:var(--entry-meta-color,#6b7280);margin-top:6px}
.entry-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:var(--badge-bg,#E8A817);color:var(--badge-color,#1B2A4A);margin-bottom:8px}

/* ── Publications base ────────────────────────────────────────────────── */
.pub{padding:var(--pub-padding,14px 0)}
.pub+.pub{border-top:var(--pub-divider,1px dashed #e5e7eb)}
.pub-title{font-weight:600;color:var(--pub-title-color,#1B2A4A);font-size:15.5px}
.pub-authors{font-size:14px;color:var(--pub-authors-color,#4b5563);margin-top:3px}
.pub-venue{font-size:14px;color:var(--pub-venue-color,#6b7280);font-style:italic;margin-top:3px}
.pub-links{margin-top:6px;display:flex;gap:14px;flex-wrap:wrap;font-size:13.5px}
.pub-links a{text-decoration:none;font-weight:500;color:var(--pub-link-color,#2B6CB0)}
.pub-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;background:var(--pub-badge-bg,#eff6ff);color:var(--pub-badge-color,#2B6CB0)}

/* ── Contact form ─────────────────────────────────────────────────────── */
.contact-card{background:var(--contact-bg,#fff);border:1px solid var(--contact-border,#e5e7eb);border-radius:14px;padding:24px}
.form-row{display:flex;gap:14px;flex-wrap:wrap}
.form-group{margin-bottom:14px;flex:1;min-width:200px}
.form-group label{display:block;font-size:13.5px;font-weight:600;color:#1f2933;margin-bottom:6px}
.form-group input,.form-group textarea{width:100%;padding:11px 13px;border:1px solid #e5e7eb;border-radius:9px;font-family:inherit;font-size:15px;color:#1f2933;background:#f8fafc}
.form-group input:focus,.form-group textarea:focus{outline:none;border-color:#2B6CB0;background:#fff}
.hp{position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden}
.alert{padding:12px 15px;border-radius:9px;font-size:14.5px;margin-bottom:16px}
.alert-success{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
.alert-error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}

/* ── Footer ───────────────────────────────────────────────────────────── */
footer{padding:28px 0 40px;text-align:center;color:var(--footer-color,#6b7280);font-size:13.5px}
footer a{font-weight:600;text-decoration:none}

/* ── Preview banner ───────────────────────────────────────────────────── */
.preview-banner{position:sticky;top:0;z-index:200;background:#E8A817;color:#3a2c00;text-align:center;padding:9px 16px;font-size:14px;font-weight:600}

/* ── Stats bar (Bold theme) ───────────────────────────────────────────── */
.stats-bar{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-top:20px}
.stat-item{text-align:center;padding:8px 18px;background:rgba(255,255,255,.08);border-radius:10px}
.stat-value{font-size:22px;font-weight:700;color:#fff;font-family:var(--head-font,'Lora'),serif}
.stat-label{font-size:12px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}

/* ── "Selected Work" cards (Researcher theme) ─────────────────────────── */
.selected-work{margin-top:32px}
.work-card{display:flex;gap:16px;padding:20px 0}
.work-card+.work-card{border-top:1px solid #f0f0f0}
.work-thumb{width:80px;height:56px;border-radius:6px;background:#f3f4f6;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;color:#9ca3af;overflow:hidden}
.work-thumb img{width:100%;height:100%;object-fit:cover}
.work-body{flex:1;min-width:0}
.work-title{font-weight:700;color:#111;font-size:16px;line-height:1.3}
.work-authors{font-size:14px;color:#666;margin-top:4px}
.work-venue{font-size:13.5px;color:#888;font-style:italic;margin-top:2px}
.work-links{margin-top:6px;display:flex;gap:12px;font-size:13.5px}
.work-links a{font-weight:500;color:#2563EB;text-decoration:none}

/* ── Responsive shared ────────────────────────────────────────────────── */
@media(max-width:480px){
    .hero{padding:36px 0 30px}
    .cta .btn{width:100%;justify-content:center}
    .stats-bar{gap:12px}
    .stat-item{padding:6px 14px}
    .stat-value{font-size:18px}
    .work-card{flex-direction:column;gap:10px}
    .work-thumb{width:100%;height:auto;aspect-ratio:16/10}
}

/* ═══════════════════════════════════════════════════════════════════════════
   THEME 1 — CLASSIC: Two-column sidebar, serif, scholarly
   ═══════════════════════════════════════════════════════════════════════════ */
.theme-classic,.theme-elegant{
    --page:#f6f8fb;--surface:#ffffff;--surface-soft:#eef3f8;--line:#d7e0ea;--line-strong:#b9c7d6;
    --ink:#17212f;--text:#2f3f52;--muted:#66758a;--quiet:#8a97a8;--brand:#245b8f;--brand-dark:#163f68;--green:#31735f;
    --radius:10px;--classic-shadow:0 10px 26px rgba(22,45,72,.08);
    --hero-bg:#fff;--hero-border:var(--line);--hero-name:var(--ink);--hero-role:var(--brand-dark);--hero-affil:var(--muted);--hero-headline:var(--text);
    --avatar-size:96px;--avatar-radius:12px;--avatar-bg:linear-gradient(145deg,var(--brand),var(--green));--avatar-color:#fff;
    --head-font:Georgia,"Times New Roman",serif;--section-heading-size:15px;--section-heading-case:none;--section-heading-spacing:0;--section-heading-color:var(--ink);
    --section-rule-content:none;--section-rule-display:none;--section-padding:0 0 34px;--section-divider:none;
    --entry-padding:15px 16px;--entry-divider:none;
    --entry-title-color:var(--ink);--entry-date-color:var(--quiet);--entry-sub-color:var(--brand-dark);--entry-desc-color:var(--muted);--entry-meta-color:var(--quiet);
    --link-border:var(--line);--link-color:var(--brand-dark);--link-bg:var(--surface);--link-hover-border:var(--line-strong);--link-hover-color:var(--brand-dark);
    --btn-primary:var(--brand);--btn-outline-bg:var(--surface);--btn-outline-color:var(--brand-dark);--btn-outline-border:var(--line);--btn-hover-border:var(--line-strong);--btn-hover-color:var(--brand-dark);
    --pub-divider:none;--pub-title-color:var(--ink);--pub-authors-color:var(--muted);--pub-venue-color:var(--muted);--pub-link-color:var(--brand);
    --contact-bg:var(--surface);--contact-border:var(--line);
    --maxw:1100px;--body-bg:var(--page);--summary-color:var(--text);--footer-color:var(--quiet);
    --nav-bg:rgba(246,248,251,.95);--nav-border:var(--line);--nav-brand:var(--ink);--nav-link:var(--muted);--nav-hover:var(--surface);--nav-active:var(--brand-dark);--nav-active-bg:var(--surface);
}
body.theme-classic,body.theme-elegant{background:var(--body-bg);color:var(--text);font-family:"Segoe UI",Roboto,Arial,sans-serif;line-height:1.55}
.theme-classic .wrap,.theme-elegant .wrap{max-width:var(--maxw);padding:0 24px}
.theme-classic .site-nav,.theme-elegant .site-nav{backdrop-filter:blur(12px)}
.theme-classic .nav-inner,.theme-elegant .nav-inner{height:56px}
.theme-classic .nav-brand,.theme-elegant .nav-brand{font-family:var(--head-font);font-size:18px;font-weight:700;max-width:260px}
.theme-classic .nav-link,.theme-elegant .nav-link{border-radius:8px;font-size:13px;font-weight:650;padding:8px 11px}
.theme-classic .hero,.theme-elegant .hero{background:linear-gradient(90deg,rgba(36,91,143,.08),transparent 42%),var(--surface);padding:0;text-align:left}
.theme-classic .hero .wrap,.theme-elegant .hero .wrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:36px;align-items:end;padding-top:48px;padding-bottom:40px}
.theme-classic .classic-hero-main,.theme-elegant .classic-hero-main{min-width:0}
.theme-classic .hero h1,.theme-elegant .hero h1{font-size:42px;font-weight:700;letter-spacing:0;line-height:1.08;margin:0}
.theme-classic .hero .role,.theme-elegant .hero .role{font-size:18px;font-weight:700;margin-top:13px}
.theme-classic .hero .affil,.theme-elegant .hero .affil{font-size:15px;line-height:1.45;margin-top:4px;color:var(--muted)}
.theme-classic .hero .headline,.theme-elegant .hero .headline{font-size:16px;line-height:1.7;max-width:720px;margin:22px 0 0;color:var(--text)}
.theme-classic .links,.theme-elegant .links{justify-content:flex-start;gap:9px;margin-top:24px}
.theme-classic .links a,.theme-elegant .links a{border-radius:8px;font-size:13px;font-weight:700;min-height:36px;padding:8px 12px}
.theme-classic .cta,.theme-elegant .cta{justify-content:flex-start;margin-top:18px}
.theme-classic .btn,.theme-elegant .btn{border-radius:8px;font-size:13px;font-weight:700;min-height:36px;padding:8px 12px}
.theme-classic main,.theme-elegant main{padding:58px 0 56px}
.theme-classic .classic-layout,.theme-elegant .classic-layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:34px;padding-top:22px}
.theme-classic .classic-layout-full,.theme-elegant .classic-layout-full{display:block;max-width:820px}
.theme-classic .classic-content,.theme-elegant .classic-content{min-width:0}
.theme-classic .classic-sidebar,.theme-elegant .classic-sidebar{align-self:start;position:sticky;top:74px}
.theme-classic .classic-toc,.theme-elegant .classic-toc{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:10px}
.theme-classic .classic-toc a,.theme-elegant .classic-toc a{display:block;border-radius:7px;color:var(--muted);font-size:13px;font-weight:700;padding:8px 10px;text-decoration:none}
.theme-classic .classic-toc a:hover,.theme-elegant .classic-toc a:hover{background:var(--surface-soft);color:var(--brand-dark);opacity:1}
.theme-classic section.block,.theme-elegant section.block{padding:0 0 34px;scroll-margin-top:132px}
.theme-classic section.block+.block,.theme-elegant section.block+.block{border-top:none}
.theme-classic .block h2,.theme-elegant .block h2{font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:15px;font-weight:800;color:var(--ink);line-height:1.2;margin-bottom:18px;padding-bottom:11px;border-bottom:1px solid var(--line);justify-content:space-between}
.theme-classic .block h2::after,.theme-elegant .block h2::after{display:none}
.theme-classic .summary-text,.theme-elegant .summary-text{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:var(--radius);font-size:15px;line-height:1.75;max-width:none;padding:17px 18px}
.theme-classic .entry-classic,.theme-elegant .entry-classic{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:15px 16px;margin:0 0 10px;box-shadow:none;transition:border-color .15s ease,box-shadow .15s ease}
.theme-classic .entry-classic:hover,.theme-elegant .entry-classic:hover{border-color:var(--line-strong);box-shadow:0 6px 18px rgba(22,45,72,.06)}
.theme-classic .entry-head,.theme-elegant .entry-head{gap:14px}
.theme-classic .entry-title,.theme-elegant .entry-title{font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:15px;font-weight:800;line-height:1.35}
.theme-classic .entry-date,.theme-elegant .entry-date{font-size:12px;font-weight:800;color:var(--quiet)}
.theme-classic .entry-sub,.theme-elegant .entry-sub{font-size:13.5px;font-weight:700;margin-top:4px}
.theme-classic .entry-desc,.theme-elegant .entry-desc{font-size:13.5px;line-height:1.65;margin-top:8px}
.theme-classic .entry-meta,.theme-elegant .entry-meta{font-size:12.5px;line-height:1.5}
.theme-classic .pub,.theme-elegant .pub{counter-increment:classic-pubs;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);display:grid;grid-template-columns:42px minmax(0,1fr);gap:13px;padding:15px 16px;margin-bottom:10px;box-shadow:none}
.theme-classic .pub::before,.theme-elegant .pub::before{content:counter(classic-pubs);align-items:center;background:var(--surface-soft);border:1px solid var(--line);border-radius:8px;color:var(--brand-dark);display:flex;font-size:13px;font-weight:800;height:34px;justify-content:center;width:34px}
.theme-classic .pub+.pub,.theme-elegant .pub+.pub{border-top:1px solid var(--line)}
.theme-classic .pub-title,.theme-elegant .pub-title{font-size:14.5px;line-height:1.45;font-weight:800}
.theme-classic .pub-authors,.theme-elegant .pub-authors{font-size:13.5px;line-height:1.5;margin-top:5px}
.theme-classic .pub-venue,.theme-elegant .pub-venue{font-size:13.5px;margin-top:4px}
.theme-classic .pub-links,.theme-elegant .pub-links{font-size:12.5px;gap:12px;margin-top:8px}
.theme-classic .pub-links a,.theme-elegant .pub-links a{font-weight:800;text-decoration:none}
.theme-classic .contact-card,.theme-elegant .contact-card{border-color:var(--line);border-radius:var(--radius);padding:18px;box-shadow:none}
.theme-classic .form-group label,.theme-elegant .form-group label{color:var(--ink);font-size:12.5px;font-weight:800}
.theme-classic .form-group input,.theme-classic .form-group textarea,.theme-elegant .form-group input,.theme-elegant .form-group textarea{background:#fbfcfe;border-color:var(--line);border-radius:8px;color:var(--text);font-size:14px;padding:10px 11px}
.classic-profile-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--classic-shadow);padding:18px}
.classic-profile-card .avatar{margin:0}
.classic-profile-name{color:var(--ink);font-size:15px;font-weight:800;margin-top:15px}
.classic-profile-meta{color:var(--muted);font-size:13px;margin-top:4px}
.classic-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
.classic-metric{border-top:1px solid var(--line);padding-top:10px}
.classic-metric strong{color:var(--ink);display:block;font-size:20px;line-height:1}
.classic-metric span{color:var(--quiet);display:block;font-size:11px;font-weight:700;margin-top:5px;text-transform:uppercase}
.theme-classic .classic-content,.theme-elegant .classic-content{counter-reset:classic-pubs}

/* ═══════════════════════════════════════════════════════════════════════════
   THEME 2 — MODERN: Single column, timeline, clean sans
   ═══════════════════════════════════════════════════════════════════════════ */
.theme-minimal,.theme-modern{
    --hero-bg:#fff;--hero-border:#e5e7eb;--hero-name:#111;--hero-role:#2563EB;--hero-affil:#6b7280;--hero-headline:#374151;
    --avatar-size:64px;--avatar-radius:50%;--avatar-bg:#2563EB;--avatar-color:#fff;
    --head-font:'Inter',sans-serif;--section-heading-size:11px;--section-heading-case:uppercase;--section-heading-spacing:.15em;--section-heading-color:#555;
    --section-rule-content:none;--section-rule-display:none;
    --section-padding:32px 0;--section-divider:1px solid #f0f0f0;
    --entry-padding:12px 0;--entry-divider:none;
    --entry-title-color:#111;--entry-date-color:#6b7280;--entry-sub-color:#2563EB;--entry-desc-color:#4b5563;
    --link-border:#e5e7eb;--link-color:#374151;--link-bg:#fff;--link-hover-border:#2563EB;--link-hover-color:#2563EB;
    --btn-primary:#2563EB;--btn-outline-bg:#fff;--btn-outline-color:#111;--btn-outline-border:#e5e7eb;--btn-hover-border:#2563EB;--btn-hover-color:#2563EB;
    --pub-divider:1px solid #f3f4f6;--pub-title-color:#111;--pub-authors-color:#4b5563;--pub-venue-color:#6b7280;
    --maxw:680px;
    --nav-bg:#fff;--nav-border:#f0f0f0;--nav-brand:#111;--nav-link:#6b7280;--nav-hover:#f3f4f6;--nav-active:#2563EB;--nav-active-bg:#eff6ff;
}
.theme-minimal .avatar,.theme-modern .avatar{display:none}
.theme-minimal .hero,.theme-modern .hero{text-align:left;padding:56px 0 36px}
.theme-minimal .links,.theme-modern .links,.theme-minimal .cta,.theme-modern .cta{justify-content:flex-start}
.theme-minimal .entry-modern,.theme-modern .entry-modern{margin-left:16px;padding-left:14px;border-left:2px solid #e5e7eb}
.theme-minimal .entry-title,.theme-modern .entry-title{font-size:15.5px;font-weight:600}
.theme-minimal .entry-sub-inline,.theme-modern .entry-sub-inline{font-size:14px;color:#6b7280}
.theme-minimal .entry-date-inline,.theme-modern .entry-date-inline{font-size:13px;color:#777}
.theme-minimal .pub-title,.theme-modern .pub-title{font-size:15px}
.theme-minimal .pub-authors,.theme-modern .pub-authors{font-size:13.5px}

/* ═══════════════════════════════════════════════════════════════════════════
   THEME 3 — BOLD: Dark navy hero, card grid, stats bar, gold accents
   ═══════════════════════════════════════════════════════════════════════════ */
.theme-bold{
    --hero-bg:#0F1B2D;--hero-border:none;--hero-name:#fff;--hero-role:#E8A817;--hero-affil:#cbd5e1;--hero-headline:#e2e8f0;
    --avatar-size:120px;--avatar-radius:50%;--avatar-bg:#E8A817;--avatar-color:#0F1B2D;
    --head-font:'Lora',serif;--section-heading-size:20px;--section-heading-case:none;--section-heading-spacing:0;--section-heading-color:#1B2A4A;
    --section-rule-content:"";--section-rule-color:#E8A817;--section-rule-display:block;
    --section-padding:40px 0;--section-divider:1px solid #e5e7eb;
    --entry-padding:16px;--entry-divider:none;
    --entry-title-color:#1B2A4A;--entry-date-color:#6b7280;--entry-sub-color:#E8A817;--entry-desc-color:#4b5563;
    --link-border:rgba(255,255,255,.25);--link-color:#fff;--link-bg:rgba(255,255,255,.08);--link-hover-border:#fff;--link-hover-color:#fff;
    --btn-primary:#E8A817;--btn-outline-bg:transparent;--btn-outline-color:#fff;--btn-outline-border:rgba(255,255,255,.3);--btn-hover-border:#fff;--btn-hover-color:#fff;
    --pub-divider:1px solid #f3f4f6;--pub-title-color:#1B2A4A;--pub-authors-color:#4b5563;
    --pub-badge-bg:#eff6ff;--pub-badge-color:#2B6CB0;
    --badge-bg:#E8A817;--badge-color:#0F1B2D;
    --maxw:880px;
}
body.theme-bold{background:#f8fafc}
.theme-bold .entry-bold{background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:box-shadow .15s ease}
.theme-bold .entry-bold:hover{box-shadow:0 4px 12px rgba(0,0,0,.08)}
.theme-bold .entry-title{font-family:'Lora',serif}
.theme-bold .pub{background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);border-top:none}
.theme-bold .btn-primary{color:#0F1B2D}

/* ═══════════════════════════════════════════════════════════════════════════
   THEME 4 — SCHOLARLY: Dark sidebar, rich pub cards, teal accent
   ═══════════════════════════════════════════════════════════════════════════ */
.theme-scholarly{
    --hero-bg:#fff;--hero-border:#e5e7eb;--hero-name:#1E293B;--hero-role:#0D9488;--hero-affil:#64748b;--hero-headline:#334155;
    --avatar-size:120px;--avatar-radius:12px;--avatar-bg:#0D9488;--avatar-color:#fff;
    --head-font:Georgia,serif;--section-heading-size:20px;--section-heading-case:none;--section-heading-spacing:0;--section-heading-color:#1E293B;
    --section-rule-content:"";--section-rule-color:#e5e7eb;--section-rule-display:block;
    --section-padding:36px 0;--section-divider:1px solid #e5e7eb;
    --entry-padding:14px 0;--entry-divider:1px solid #f0f0f0;
    --entry-title-color:#1E293B;--entry-date-color:#64748b;--entry-sub-color:#0D9488;--entry-desc-color:#475569;
    --link-border:#cbd5e1;--link-color:#334155;--link-bg:#fff;--link-hover-border:#0D9488;--link-hover-color:#0D9488;
    --btn-primary:#0D9488;--btn-outline-bg:#fff;--btn-outline-color:#334155;--btn-outline-border:#cbd5e1;--btn-hover-border:#0D9488;--btn-hover-color:#0D9488;
    --pub-divider:1px solid #f0f0f0;--pub-title-color:#1E293B;--pub-authors-color:#475569;
    --pub-badge-bg:#f0fdfa;--pub-badge-color:#0D9488;
    --maxw:750px;
    --nav-bg:#1E293B;--nav-border:#334155;--nav-brand:#fff;--nav-link:#94a3b8;--nav-hover:rgba(255,255,255,.08);--nav-active:#0D9488;--nav-active-bg:rgba(13,148,136,.12);
}
.theme-scholarly .block h2{font-family:Georgia,serif;font-size:20px;font-weight:600}
.theme-scholarly .entry-scholarly{padding:14px 16px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:10px;transition:box-shadow .15s ease}
.theme-scholarly .entry-scholarly:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}
.theme-scholarly .entry-scholarly+.entry-scholarly{border-top:1px solid #e5e7eb}
.theme-scholarly .pub{padding:14px 16px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:10px;transition:box-shadow .15s ease}
.theme-scholarly .pub:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}
.theme-scholarly .pub+.pub{border-top:1px solid #e5e7eb}

/* ═══════════════════════════════════════════════════════════════════════════
   THEME 5 — RESEARCHER: Pure typography, generous spacing, "Selected Work"
   ═══════════════════════════════════════════════════════════════════════════ */
.theme-researcher{
    --hero-bg:#fff;--hero-border:none;--hero-name:#111;--hero-role:#2563EB;--hero-affil:#666;--hero-headline:#444;
    --avatar-size:130px;--avatar-radius:50%;--avatar-bg:#2563EB;--avatar-color:#fff;
    --head-font:'Inter',sans-serif;--section-heading-size:20px;--section-heading-case:none;--section-heading-spacing:0;--section-heading-color:#111;
    --section-rule-content:none;--section-rule-display:none;
    --section-padding:32px 0;--section-divider:none;
    --entry-padding:18px 0;--entry-divider:none;
    --entry-title-color:#111;--entry-date-color:#888;--entry-sub-color:#444;--entry-desc-color:#555;
    --link-border:#e5e7eb;--link-color:#555;--link-bg:#fff;--link-hover-border:#2563EB;--link-hover-color:#2563EB;
    --btn-primary:#2563EB;--btn-outline-bg:#fff;--btn-outline-color:#111;--btn-outline-border:#e5e7eb;--btn-hover-border:#2563EB;--btn-hover-color:#2563EB;
    --pub-divider:1px solid #f0f0f0;--pub-title-color:#111;--pub-authors-color:#555;
    --maxw:700px;
}
.theme-researcher .hero{border-bottom:none;padding:60px 0 24px}
.theme-researcher .block h2{font-weight:700;font-size:20px;color:#111;margin-bottom:18px;margin-top:20px}
.theme-researcher .block+.block{border-top:none}
.theme-researcher .entry-researcher+.entry-researcher{margin-top:12px}
.theme-researcher .entry-title{font-weight:700;font-size:16px}
.theme-researcher .entry-sub-line{font-size:14px;color:#666}
.theme-researcher .entry-date-muted{font-size:13px;color:#999}
.theme-researcher .entry-desc{line-height:1.7;font-size:15.5px}
.theme-researcher .pub{padding:18px 0}
.theme-researcher .pub-title{font-size:16px}
.theme-researcher .links a{border-color:#e5e7eb;padding:6px 12px;font-size:13px}

/* ── Multi-page nav responsive ────────────────────────────────────────── */
@media(max-width:768px){
    .hero{text-align:center}
    .theme-classic .hero,.theme-elegant .hero{text-align:left}
    .theme-classic .hero .wrap,.theme-elegant .hero .wrap{grid-template-columns:1fr;gap:22px;padding-top:34px;padding-bottom:30px}
    .theme-classic .classic-profile-card,.theme-elegant .classic-profile-card{max-width:420px}
    .theme-classic .hero h1,.theme-elegant .hero h1{font-size:34px}
    .theme-classic main,.theme-elegant main{padding-top:46px}
    .theme-classic .classic-layout,.theme-elegant .classic-layout{grid-template-columns:1fr;padding-top:0}
    .theme-classic .classic-sidebar,.theme-elegant .classic-sidebar{display:none}
    .theme-minimal .links,.theme-modern .links{justify-content:center}
    .theme-minimal .cta,.theme-modern .cta{justify-content:center}
    .nav-links{display:none;position:absolute;top:52px;left:0;right:0;background:var(--nav-bg,#fff);border-bottom:1px solid var(--nav-border,#e5e7eb);flex-direction:column;padding:8px;gap:4px}
    .theme-classic .nav-links,.theme-elegant .nav-links{top:56px}
    .nav-links.open{display:flex}
    .nav-toggle{display:flex}
    .nav-link{width:100%;border-radius:6px;padding:10px 14px}
}
@media(max-width:480px){
    .avatar{width:80px!important;height:80px!important;font-size:28px}
    .theme-classic .wrap,.theme-elegant .wrap{padding-left:18px;padding-right:18px}
    .theme-classic .hero h1,.theme-elegant .hero h1{font-size:32px}
    .theme-classic section.block,.theme-elegant section.block{padding:0 0 30px}
    .theme-classic .classic-metrics,.theme-elegant .classic-metrics{grid-template-columns:1fr}
    .theme-classic .entry-classic,.theme-elegant .entry-classic{margin-left:0;padding:12px 13px}
    .theme-classic .pub,.theme-elegant .pub{grid-template-columns:1fr;padding:12px 13px}
    .theme-minimal .entry-modern,.theme-modern .entry-modern{margin-left:0;border-left:none;padding-left:0}
    .theme-scholarly .entry-scholarly{border-radius:8px;padding:12px}
    .theme-bold .entry-bold{border-radius:8px;padding:12px 14px}
}
@media print{
    .site-nav,.preview-banner,.cta,footer,.hp{display:none!important}
    body{font-size:11pt;line-height:1.4}
    .block+.block{border-top:1px solid #ccc}
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

<?php if ($showNav): ?>
    <?php include __DIR__ . '/_nav.php'; ?>
<?php endif; ?>

<?php if ($showAbout): ?>
<header class="hero">
    <div class="wrap">
        <?php if ($isClassicTheme): ?>
        <div class="classic-hero-main">
        <?php endif; ?>

        <?php if (!$isClassicTheme && (!$isMulti || $currentPage === 'about')): ?>
        <div class="avatar"><?php if ($hasAvatar): ?><img src="<?= e($avatarUrl) ?>" alt="<?= e($fullName) ?>" referrerpolicy="no-referrer"><?php else: ?><?= e($initials !== '' ? $initials : 'CV') ?><?php endif; ?></div>
        <?php endif; ?>
        <h1><?= e($fullName) ?></h1>
        <?php if ($roleLine !== ''): ?><div class="role"><?= e($roleLine) ?></div><?php endif; ?>
        <?php if ($affiliation !== ''): ?><div class="affil"><?= e($affiliation) ?></div><?php endif; ?>
        <?php if (!empty($p['location'])): ?><div class="affil"><i class="bi bi-geo-alt"></i> <?= e($p['location']) ?></div><?php endif; ?>
        <?php if ($displayHeadline !== ''): ?><p class="headline"><?= e($displayHeadline) ?></p><?php endif; ?>

        <?php if (!empty($p['links']) || !empty($p['email'])): ?>
        <div class="links">
            <?php foreach ($linkMeta as $key => $meta): ?>
                <?php if (!empty($p['links'][$key])):
                    $href = $p['links'][$key];
                    if (!preg_match('~^https?://~i', $href)) {
                        $href = ($key === 'orcid') ? 'https://orcid.org/' . ltrim($href, '/') : 'https://' . $href;
                    } ?>
                    <a href="<?= e($href) ?>" target="_blank" rel="noopener nofollow"><i class="bi <?= e($meta[0]) ?>"></i> <?= e($meta[1]) ?></a>
                <?php endif; ?>
            <?php endforeach; ?>
            <?php if (!empty($p['email'])): ?><a href="mailto:<?= e($p['email']) ?>"><i class="bi bi-envelope"></i> Email</a><?php endif; ?>
            <?php if (!empty($p['phone'])): ?><a href="tel:<?= e(preg_replace('/[^0-9+]/', '', $p['phone'])) ?>"><i class="bi bi-telephone"></i> <?= e($p['phone']) ?></a><?php endif; ?>
        </div>
        <?php endif; ?>

        <?php if ($templateKey === 'bold' && !empty($stats)):
            $statCount = (int)(!empty($stats['publications'])) + (int)(!empty($stats['years'])) + (int)(!empty($stats['grants']));
            if ($statCount >= 2): ?>
        <div class="stats-bar">
            <?php if (!empty($stats['publications'])): ?><div class="stat-item"><div class="stat-value"><?= (int) $stats['publications'] ?>+</div><div class="stat-label">Publications</div></div><?php endif; ?>
            <?php if (!empty($stats['years'])): ?><div class="stat-item"><div class="stat-value"><?= (int) $stats['years'] ?></div><div class="stat-label">Years</div></div><?php endif; ?>
            <?php if (!empty($stats['grants'])): ?><div class="stat-item"><div class="stat-value"><?= (int) $stats['grants'] ?></div><div class="stat-label">Grants</div></div><?php endif; ?>
        </div>
        <?php endif; endif; ?>

        <?php if (($downloadAvailable || $contactEnabled) && $slug !== '' && !$isMulti): ?>
        <div class="cta">
            <?php if ($downloadAvailable): ?><a class="btn btn-primary" href="<?= e(APP_URL . '/u/' . $slug . '/cv') ?>"><i class="bi bi-download"></i> Download CV</a><?php endif; ?>
            <?php if ($contactEnabled): ?><a class="btn btn-outline" href="#contact"><i class="bi bi-chat-dots"></i> Get in touch</a><?php endif; ?>
        </div>
        <?php endif; ?>

        <?php if ($isClassicTheme): ?>
        </div>
        <aside class="classic-profile-card" aria-label="Profile summary">
            <?php if (!$isMulti || $currentPage === 'about'): ?>
            <div class="avatar"><?php if ($hasAvatar): ?><img src="<?= e($avatarUrl) ?>" alt="<?= e($fullName) ?>" referrerpolicy="no-referrer"><?php else: ?><?= e($initials !== '' ? $initials : 'CV') ?><?php endif; ?></div>
            <?php endif; ?>
            <div class="classic-profile-name"><?= e($fullName) ?></div>
            <?php if ($roleLine !== '' || $affiliation !== ''): ?>
                <div class="classic-profile-meta"><?= e(trim($roleLine . ($roleLine !== '' && $affiliation !== '' ? ', ' : '') . $affiliation)) ?></div>
            <?php endif; ?>
            <?php
            $classicStats = [
                ['value' => (int) ($stats['publications'] ?? 0), 'label' => 'Papers'],
                ['value' => (int) ($stats['years'] ?? 0), 'label' => 'Years'],
                ['value' => (int) ($stats['grants'] ?? 0), 'label' => 'Grants'],
            ];
            $classicVisibleStats = array_filter($classicStats, static fn($stat) => !empty($stat['value']));
            ?>
            <?php if (!empty($classicVisibleStats)): ?>
            <div class="classic-metrics">
                <?php foreach ($classicStats as $stat): ?>
                    <div class="classic-metric">
                        <strong><?= (int) $stat['value'] ?></strong>
                        <span><?= e($stat['label']) ?></span>
                    </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </aside>
        <?php endif; ?>
    </div>
</header>
<?php endif; ?>

<main>
    <?php if ($isClassicTheme && !$isMulti): ?>
    <div class="wrap classic-layout<?= empty($classicTocLinks) ? ' classic-layout-full' : '' ?>">
        <?php if (!empty($classicTocLinks)): ?>
        <aside class="classic-sidebar">
            <nav class="classic-toc" aria-label="Website sections">
                <?php foreach ($classicTocLinks as $link): ?>
                    <a href="#<?= e($link[0]) ?>"><?= e($link[1]) ?></a>
                <?php endforeach; ?>
            </nav>
        </aside>
        <?php endif; ?>
        <div class="classic-content">
    <?php endif; ?>

    <?php if ($showAbout): ?>
    <?php if (!empty($site['summary'])): ?>
    <section class="block" id="about">
        <div class="<?= $isClassicTheme && !$isMulti ? '' : 'wrap' ?>">
            <h2>About</h2>
            <p class="summary-text"><?= nl2br(e($site['summary'])) ?></p>
        </div>
    </section>
    <?php endif; ?>

    <?php foreach (($site['sections'] ?? []) as $section): ?>
        <?php if (empty($section['entries'])) continue; ?>
        <?php if ($isMulti && in_array($section['key'] ?? '', ['publications', 'teaching', 'supervision', 'education'], true)) continue; ?>
        <section class="block" id="<?= e((string) ($section['key'] ?? 'section')) ?>">
            <div class="<?= $isClassicTheme && !$isMulti ? '' : 'wrap' ?>">
                <h2><?= e($section['label']) ?></h2>
                <?php foreach ($section['entries'] as $entry): ?>
                    <?= $entryRenderer(is_array($entry) ? $entry : []) ?>
                <?php endforeach; ?>
            </div>
        </section>
    <?php endforeach; ?>
    <?php endif; ?>

    <?php if ($showPubs && !empty($site['publications'])): ?>
    <section class="block" id="publications">
        <div class="<?= $isClassicTheme && !$isMulti ? '' : 'wrap' ?>">
            <h2>Publications</h2>
            <?php foreach ($site['publications'] as $i => $pub): ?>
                <div class="pub">
                    <?php if ($templateKey === 'bold'): ?>
                        <?php if (!empty($pub['doi'])): ?><span class="pub-badge">DOI</span><?php endif; ?>
                    <?php endif; ?>
                    <?php if (!empty($pub['title'])): ?>
                        <div class="pub-title">
                            <?php if (($templateKey === 'classic' || $templateKey === 'elegant') && !$isClassicTheme): ?>[<?= $i + 1 ?>] <?php endif; ?>
                            <?= e($pub['title']) ?><?= !empty($pub['year']) ? ' (' . e($pub['year']) . ')' : '' ?>
                        </div>
                    <?php endif; ?>
                    <?php if (!empty($pub['authors'])): ?><div class="pub-authors"><?= e($pub['authors']) ?></div><?php endif; ?>
                    <?php if (!empty($pub['venue'])): ?><div class="pub-venue"><?= e($pub['venue']) ?><?= !empty($pub['year']) ? ', ' . e($pub['year']) : '' ?></div><?php endif; ?>
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

    <?php if ($showTeaching): ?>
    <?php foreach (($site['sections'] ?? []) as $section): ?>
        <?php if (empty($section['entries'])) continue; ?>
        <?php if (!in_array($section['key'] ?? '', ['teaching', 'supervision', 'education'], true)) continue; ?>
        <section class="block" id="<?= e((string) ($section['key'] ?? 'section')) ?>">
            <div class="wrap">
                <h2><?= e($section['label']) ?></h2>
                <?php foreach ($section['entries'] as $entry): ?>
                    <?= $entryRenderer(is_array($entry) ? $entry : []) ?>
                <?php endforeach; ?>
            </div>
        </section>
    <?php endforeach; ?>
    <?php endif; ?>

    <?php if ($showCvPage): ?>
    <section class="block" id="cv">
        <div class="<?= $isClassicTheme && !$isMulti ? '' : 'wrap' ?>">
            <h2>Curriculum Vitae</h2>
            <?php if ($downloadAvailable): ?>
                <p class="summary-text" style="margin-bottom:16px">Download my full academic CV below.</p>
                <a class="btn btn-primary" href="<?= e(APP_URL . '/u/' . $slug . '/cv') ?>"><i class="bi bi-download"></i> Download CV (PDF)</a>
            <?php else: ?>
                <p class="summary-text">CV download is not yet available. Please check back later.</p>
            <?php endif; ?>
        </div>
    </section>
    <?php endif; ?>

    <?php if ($showContact && $contactEnabled && $slug !== ''): ?>
    <section class="block" id="contact">
        <div class="<?= $isClassicTheme && !$isMulti ? '' : 'wrap' ?>">
            <h2>Contact</h2>
            <?php if ($contactParam === 'success' || ($contactFlash['status'] ?? '') === 'success'): ?>
                <div class="alert alert-success"><i class="bi bi-check-circle"></i> <?= e($contactFlash['message'] ?? 'Thanks! Your message has been sent.') ?></div>
            <?php elseif ($contactParam === 'error' && !empty($contactFlash['message'])): ?>
                <div class="alert alert-error"><i class="bi bi-exclamation-circle"></i> <?= e($contactFlash['message']) ?></div>
            <?php endif; ?>
            <div class="contact-card">
                <?php if (!empty($isPreview)): ?>
                    <p style="color:#6b7280;font-size:14.5px;"><i class="bi bi-info-circle"></i> The contact form is active on your published site. This is a preview.</p>
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

    <?php if ($isClassicTheme && !$isMulti): ?>
        </div>
    </div>
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
