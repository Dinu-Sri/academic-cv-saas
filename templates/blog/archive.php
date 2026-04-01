<!-- Breadcrumb -->
<div class="container mk-breadcrumb">
    <a href="<?= APP_URL ?>/">Home</a>
    <span class="mx-2 text-muted">/</span>
    <?php if (!empty($filterLabel)): ?>
        <a href="<?= APP_URL ?>/blog">Blog</a>
        <span class="mx-2 text-muted">/</span>
        <span class="text-muted"><?= e($filterLabel) ?></span>
    <?php else: ?>
        <span class="text-muted">Blog</span>
    <?php endif; ?>
</div>

<section class="mk-section pt-3">
    <div class="container">
        <div class="row">
            <!-- Main Content -->
            <div class="col-lg-8">
                <div class="d-flex flex-wrap align-items-center justify-content-between mb-4">
                    <h1 class="mk-section-title mb-2">
                        <?php if (!empty($filterLabel)): ?>
                            <?= e($filterLabel) ?>
                        <?php elseif (!empty($q)): ?>
                            Search: "<?= e($q) ?>"
                        <?php else: ?>
                            Academic CV Blog
                        <?php endif; ?>
                    </h1>
                    <span class="text-muted small"><?= $paginated['total'] ?> article<?= $paginated['total'] !== 1 ? 's' : '' ?></span>
                </div>

                <!-- Search -->
                <form class="mb-4" action="<?= APP_URL ?>/blog" method="GET">
                    <div class="input-group">
                        <input type="text" class="form-control" name="q" value="<?= e($q ?? '') ?>" placeholder="Search articles...">
                        <button class="btn btn-primary" type="submit"><i class="bi bi-search"></i></button>
                        <?php if (!empty($q)): ?>
                            <a href="<?= APP_URL ?>/blog" class="btn btn-outline-secondary">Clear</a>
                        <?php endif; ?>
                    </div>
                </form>

                <?php if (empty($paginated['posts'])): ?>
                    <div class="text-center py-5">
                        <i class="bi bi-journal-x fs-1 text-muted"></i>
                        <p class="text-muted mt-3">No articles found<?= !empty($q) ? ' for "' . e($q) . '"' : '' ?>.</p>
                        <a href="<?= APP_URL ?>/blog" class="btn btn-outline-primary btn-sm">View All Articles</a>
                    </div>
                <?php else: ?>
                    <!-- Post Grid -->
                    <div class="row g-4">
                        <?php foreach ($paginated['posts'] as $p): ?>
                        <div class="col-md-6">
                            <a href="<?= APP_URL ?>/blog/<?= e($p['slug']) ?>" class="text-decoration-none">
                                <div class="mk-blog-card">
                                    <?php if (!empty($p['featured_image'])): ?>
                                        <img src="<?= APP_URL ?>/assets/images/blog/<?= e($p['featured_image']) ?>" alt="<?= e($p['title']) ?>" loading="lazy">
                                    <?php else: ?>
                                        <div style="height:200px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;">
                                            <i class="bi bi-journal-richtext text-white" style="font-size:3rem;opacity:.4"></i>
                                        </div>
                                    <?php endif; ?>
                                    <div class="card-body">
                                        <div class="mk-blog-meta mb-2">
                                            <span><i class="bi bi-calendar3 me-1"></i><?= date('M j, Y', strtotime($p['date'])) ?></span>
                                            <span class="mx-2">&middot;</span>
                                            <span><i class="bi bi-clock me-1"></i><?= $p['reading_time'] ?> min read</span>
                                        </div>
                                        <h5 class="card-title text-dark"><?= e($p['title']) ?></h5>
                                        <p class="card-text"><?= e($p['description'] ?? '') ?></p>
                                        <?php if (!empty($p['category'])): ?>
                                            <span class="mk-blog-tag"><?= e($p['category']) ?></span>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </a>
                        </div>
                        <?php endforeach; ?>
                    </div>

                    <!-- Pagination -->
                    <?php if ($paginated['totalPages'] > 1): ?>
                    <nav class="mt-5">
                        <ul class="pagination justify-content-center">
                            <?php
                            $baseUrl = strtok($_SERVER['REQUEST_URI'], '?');
                            $params = $_GET;
                            ?>
                            <li class="page-item <?= $paginated['page'] <= 1 ? 'disabled' : '' ?>">
                                <?php $params['page'] = $paginated['page'] - 1; ?>
                                <a class="page-link" href="<?= $baseUrl ?>?<?= http_build_query($params) ?>">Previous</a>
                            </li>
                            <?php for ($i = 1; $i <= $paginated['totalPages']; $i++): ?>
                            <li class="page-item <?= $i === $paginated['page'] ? 'active' : '' ?>">
                                <?php $params['page'] = $i; ?>
                                <a class="page-link" href="<?= $baseUrl ?>?<?= http_build_query($params) ?>"><?= $i ?></a>
                            </li>
                            <?php endfor; ?>
                            <li class="page-item <?= $paginated['page'] >= $paginated['totalPages'] ? 'disabled' : '' ?>">
                                <?php $params['page'] = $paginated['page'] + 1; ?>
                                <a class="page-link" href="<?= $baseUrl ?>?<?= http_build_query($params) ?>">Next</a>
                            </li>
                        </ul>
                    </nav>
                    <?php endif; ?>
                <?php endif; ?>
            </div>

            <!-- Sidebar -->
            <div class="col-lg-4">
                <!-- Categories -->
                <?php if (!empty($categories)): ?>
                <div class="mb-4 p-4 bg-white rounded-3 shadow-sm">
                    <h6 class="fw-bold mb-3"><i class="bi bi-folder me-2"></i>Categories</h6>
                    <ul class="list-unstyled mb-0">
                        <?php foreach ($categories as $cat => $count): ?>
                        <li class="mb-2">
                            <a href="<?= APP_URL ?>/blog/category/<?= urlencode(strtolower($cat)) ?>" class="text-decoration-none d-flex justify-content-between align-items-center">
                                <span><i class="bi bi-folder2 me-2 text-primary"></i><?= e($cat) ?></span>
                                <span class="badge rounded-pill" style="background:#eef3fb;color:#0d6efd;font-size:.75rem;"><?= $count ?></span>
                            </a>
                        </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
                <?php endif; ?>

                <!-- Tags -->
                <?php if (!empty($tags)): ?>
                <div class="mb-4 p-4 bg-white rounded-3 shadow-sm">
                    <h6 class="fw-bold mb-3"><i class="bi bi-tags me-2"></i>Tags</h6>
                    <div class="d-flex flex-wrap gap-2">
                        <?php foreach ($tags as $tag => $count): ?>
                        <a href="<?= APP_URL ?>/blog/tag/<?= urlencode(strtolower($tag)) ?>" class="mk-blog-tag text-decoration-none"><?= e($tag) ?></a>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>

                <!-- CTA -->
                <div class="p-4 rounded-3 text-white text-center" style="background:linear-gradient(135deg,#0b1a3b,#0d6efd);">
                    <h6 class="fw-bold mb-2">Build Your Academic CV</h6>
                    <p class="small opacity-75 mb-3">Free. No credit card. Professional LaTeX-style formatting.</p>
                    <a href="<?= APP_URL ?>/register" class="btn btn-light btn-sm fw-semibold">Start Free</a>
                </div>
            </div>
        </div>
    </div>
</section>
