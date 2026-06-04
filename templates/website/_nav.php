<?php
/**
 * Multi-page navigation bar for academic websites.
 * Only rendered when site_mode === 'multi'.
 *
 * Expected vars:
 *   $slug        string  Website slug
 *   $currentPage string  'about' | 'publications' | 'teaching' | 'cv' | 'contact'
 *   $navConfig   array   Which pages are enabled {about:true, publications:true, ...}
 *   $templateKey string  Theme key for styling
 *   $publicUrl   string  Base public URL
 */

$navItems = [
    'about'        => ['label' => 'About',        'icon' => 'bi-person'],
    'publications' => ['label' => 'Publications', 'icon' => 'bi-journal-text'],
    'teaching'     => ['label' => 'Teaching',     'icon' => 'bi-mortarboard'],
    'cv'           => ['label' => 'CV',           'icon' => 'bi-file-earmark-pdf'],
    'contact'      => ['label' => 'Contact',      'icon' => 'bi-envelope'],
];
?>
<nav class="site-nav" id="siteNav" role="navigation" aria-label="Site navigation">
    <div class="nav-inner">
        <a href="<?= e($publicUrl) ?>" class="nav-brand" aria-label="Home">
            <?= e(mb_substr($fullName ?? 'Home', 0, 20)) ?>
        </a>
        <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded="false" type="button">
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
        </button>
        <ul class="nav-links" id="navLinks">
            <?php foreach ($navItems as $key => $item): ?>
                <?php if (!empty($navConfig[$key])): ?>
                    <?php $href = $key === 'about' ? $publicUrl : $publicUrl . '/' . $key; ?>
                    <li>
                        <a href="<?= e($href) ?>" class="nav-link<?= ($currentPage ?? 'about') === $key ? ' active' : '' ?>">
                            <i class="bi <?= e($item['icon']) ?> nav-link-icon"></i>
                            <span><?= e($item['label']) ?></span>
                        </a>
                    </li>
                <?php endif; ?>
            <?php endforeach; ?>
        </ul>
    </div>
</nav>

<script>
(function(){
    var toggle = document.getElementById('navToggle');
    var links = document.getElementById('navLinks');
    if (toggle && links) {
        toggle.addEventListener('click', function(){
            var open = links.classList.toggle('open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        links.querySelectorAll('a').forEach(function(a){
            a.addEventListener('click', function(){ links.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); });
        });
    }
})();
</script>
