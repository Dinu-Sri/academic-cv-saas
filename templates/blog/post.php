<!-- Breadcrumb -->
<div class="container-xl mk-breadcrumb">
    <a href="<?= APP_URL ?>/">Home</a>
    <span class="mx-2 text-muted">/</span>
    <a href="<?= APP_URL ?>/blog">Blog</a>
    <span class="mx-2 text-muted">/</span>
    <span class="text-muted"><?= e($post['title']) ?></span>
</div>

<article class="mk-section mk-article pt-3">
    <div class="container-xl">
        <div class="row g-lg-5">
            <!-- Article -->
            <div class="col-lg-8 col-xl-9">
                <header class="mb-4">
                    <?php if (!empty($post['category'])): ?>
                        <a href="<?= APP_URL ?>/blog/category/<?= urlencode(strtolower($post['category'])) ?>" class="mk-blog-tag text-decoration-none mb-3 d-inline-block"><?= e($post['category']) ?></a>
                    <?php endif; ?>

                    <h1 class="fw-bold mb-3" style="font-size:2.2rem;line-height:1.3;"><?= e($post['title']) ?></h1>

                    <?php if (!empty($post['description'])): ?>
                        <p class="lead text-muted mb-3"><?= e($post['description']) ?></p>
                    <?php endif; ?>

                    <div class="mk-blog-meta mb-4">
                        <?php if (!empty($post['author'])): ?>
                            <span><i class="bi bi-person me-1"></i><?= e($post['author']) ?></span>
                            <span class="mx-2">&middot;</span>
                        <?php endif; ?>
                        <span><i class="bi bi-calendar3 me-1"></i><?= date('F j, Y', strtotime($post['date'])) ?></span>
                        <span class="mx-2">&middot;</span>
                        <span><i class="bi bi-clock me-1"></i><?= $post['reading_time'] ?> min read</span>
                    </div>
                </header>

                <!-- Mobile TOC (collapsed by default) -->
                <?php if (!empty($post['toc'])): ?>
                <div class="mk-toc-mobile d-lg-none mb-4">
                    <button class="mk-toc-toggle w-100" type="button" data-bs-toggle="collapse" data-bs-target="#mobileToc" aria-expanded="false" aria-controls="mobileToc">
                        <i class="bi bi-list-nested me-2"></i>Contents
                        <i class="bi bi-chevron-down mk-toc-chevron ms-auto"></i>
                    </button>
                    <div class="collapse" id="mobileToc">
                        <div class="mk-toc-body">
                            <ul class="list-unstyled mb-0 small">
                                <?php foreach ($post['toc'] as $item): ?>
                                <li class="<?= $item['level'] === 3 ? 'ms-3' : '' ?> mb-2">
                                    <a href="#<?= e($item['id']) ?>" class="text-decoration-none text-muted toc-link"><?= e($item['text']) ?></a>
                                </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    </div>
                </div>
                <?php endif; ?>

                <?php if (!empty($post['featured_image'])): ?>
                    <img src="<?= APP_URL ?>/assets/images/blog/<?= e($post['featured_image']) ?>" alt="<?= e($post['title']) ?>" class="w-100 rounded-3 mb-4" loading="lazy">
                <?php endif; ?>

                <!-- Article Body -->
                <div class="mk-article-body">
                    <?= $post['body_html'] ?>
                </div>

                <!-- Tags -->
                <?php if (!empty($post['tags'])): ?>
                <div class="mt-5 pt-4 border-top">
                    <h6 class="fw-bold mb-3"><i class="bi bi-tags me-2"></i>Tags</h6>
                    <div class="d-flex flex-wrap gap-2">
                        <?php foreach ($post['tags'] as $tag): ?>
                            <a href="<?= APP_URL ?>/blog/tag/<?= urlencode(strtolower($tag)) ?>" class="mk-blog-tag text-decoration-none"><?= e($tag) ?></a>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>

                <!-- Related Posts -->
                <?php if (!empty($related)): ?>
                <div class="mt-5 pt-4 border-top">
                    <h6 class="fw-bold mb-4">Related Articles</h6>
                    <div class="row g-3">
                        <?php foreach ($related as $r): ?>
                        <div class="col-md-4">
                            <a href="<?= APP_URL ?>/blog/<?= e($r['slug']) ?>" class="text-decoration-none">
                                <div class="mk-blog-card h-100">
                                    <?php if (!empty($r['featured_image'])): ?>
                                        <img src="<?= APP_URL ?>/assets/images/blog/<?= e($r['featured_image']) ?>" alt="<?= e($r['title']) ?>" loading="lazy" style="height:120px;object-fit:cover;">
                                    <?php else: ?>
                                        <div style="height:120px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;">
                                            <i class="bi bi-journal-richtext text-white" style="font-size:2rem;opacity:.4"></i>
                                        </div>
                                    <?php endif; ?>
                                    <div class="card-body p-3">
                                        <h6 class="card-title text-dark small mb-1"><?= e($r['title']) ?></h6>
                                        <span class="text-muted" style="font-size:.75rem;"><?= $r['reading_time'] ?> min read</span>
                                    </div>
                                </div>
                            </a>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>
            </div>

            <!-- Sidebar (desktop only) -->
            <div class="col-lg-4 col-xl-3 d-none d-lg-block">
                <!-- TOC -->
                <?php if (!empty($post['toc'])): ?>
                <div class="mk-toc-desktop">
                    <h6 class="fw-bold mb-3"><i class="bi bi-list-nested me-2"></i>Contents</h6>
                    <ul class="list-unstyled mb-0 small">
                        <?php foreach ($post['toc'] as $item): ?>
                        <li class="<?= $item['level'] === 3 ? 'ms-3' : '' ?> mb-2">
                            <a href="#<?= e($item['id']) ?>" class="text-decoration-none text-muted toc-link"><?= e($item['text']) ?></a>
                        </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
                <?php endif; ?>

                <!-- CTA -->
                <div class="mk-sidebar-cta p-4 rounded-3 text-white text-center mb-4" style="background:linear-gradient(135deg,#0b1a3b,#0d6efd);">
                    <h6 class="fw-bold mb-2">Build Your Academic CV</h6>
                    <p class="small opacity-75 mb-3">Free. No credit card. Professional PDFs rendered with real LaTeX.</p>
                    <a href="<?= APP_URL ?>/register" class="btn btn-light btn-sm fw-semibold">Start Free</a>
                </div>
            </div>
        </div>
    </div>
</article>

<!-- Scroll-tracking active TOC link + close mobile TOC on link click -->
<script>
document.addEventListener('DOMContentLoaded', function() {
    const tocLinks = document.querySelectorAll('.toc-link');
    if (!tocLinks.length) return;
    const headings = [];
    tocLinks.forEach(link => {
        const id = link.getAttribute('href').substring(1);
        const el = document.getElementById(id);
        if (el) headings.push({ el: el, link: link });
    });
    function updateActive() {
        let current = headings[0];
        headings.forEach(h => {
            if (h.el.getBoundingClientRect().top <= 120) current = h;
        });
        tocLinks.forEach(l => l.classList.remove('fw-semibold', 'text-primary'));
        if (current) {
            current.link.classList.add('fw-semibold', 'text-primary');
        }
    }
    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();

    // Close mobile TOC when a link is clicked
    var mobileToc = document.getElementById('mobileToc');
    if (mobileToc) {
        mobileToc.querySelectorAll('.toc-link').forEach(function(link) {
            link.addEventListener('click', function() {
                bootstrap.Collapse.getOrCreateInstance(mobileToc).hide();
            });
        });
    }
});
</script>
