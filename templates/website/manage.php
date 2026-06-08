<?php
/**
 * Academic website management dashboard (owner view).
 * Rendered inside templates/layouts/main.php via $content.
 *
 * Vars: $website, $created, $cvOptions, $viewModel, $unreadMessages, $publicUrl
 */
$sv = is_array($website['section_visibility'] ?? null) ? $website['section_visibility'] : AcademicWebsite::defaultSectionVisibility();
$fv = is_array($website['field_visibility'] ?? null) ? $website['field_visibility'] : AcademicWebsite::defaultFieldVisibility();
$isPublished = ($website['status'] ?? 'draft') === 'published';
$slug = (string) $website['slug'];
$csrf = $_SESSION['csrf_token'] ?? '';

$sectionLabels = [
    'academic_profile'   => 'About / Summary',
    'research_interests' => 'Research Interests',
    'education'          => 'Education',
    'experience'         => 'Experience',
    'teaching'           => 'Teaching',
    'publications'       => 'Publications',
    'projects'           => 'Projects',
    'skills'             => 'Skills',
    'awards'             => 'Awards & Honours',
    'grants'             => 'Grants & Funding',
    'conferences'        => 'Conferences',
    'supervision'        => 'Supervision',
    'memberships'        => 'Memberships',
    'languages'          => 'Languages',
    'references'         => 'References',
];
$templateOptions = [
    'elegant'    => ['Classic', 'Professional academic website with compact profile layout, balanced typography, and structured content cards.', '#1D4E89', '#F8FAFC', '#102A43'],
    'minimal'    => ['Modern', 'Clean, single-column, timeline entries. Best for PhDs, postdocs, and CS/engineering.', '#2563EB', '#FFFFFF', '#111111'],
    'bold'       => ['Bold', 'Dark navy hero with gold accents and stats bar. Best for established researchers.', '#E8A817', '#0F1B2D', '#FFFFFF'],
    'scholarly'  => ['Scholarly', 'Dark sidebar nav, rich publication cards, teal accent. Ideal for multi-page portfolios.', '#0D9488', '#1E293B', '#FFFFFF'],
    'researcher' => ['Researcher', 'Pure typography, content-first, generous whitespace. Best for single-page, Carlini-style sites.', '#2563EB', '#FFFFFF', '#111111'],
];
$currentTemplate = $website['template_key'] ?? 'elegant';
$currentAvatarUrl = $currentAvatarUrl ?? trim((string) ($viewModel['personal']['avatar_url'] ?? ''));
?>
<div class="container py-4" style="max-width: 1100px;">
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
            <h1 class="h3 mb-1"><i class="bi bi-globe me-2 text-primary"></i>My Academic Website</h1>
            <p class="text-muted mb-0">A clean, mobile-friendly one-page site built from your archive profile.</p>
        </div>
        <a href="/website/messages" class="btn btn-outline-secondary position-relative">
            <i class="bi bi-inbox me-1"></i> Messages
            <?php if (!empty($unreadMessages)): ?>
                <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"><?= (int) $unreadMessages ?></span>
            <?php endif; ?>
        </a>
    </div>

    <?php if (!empty($created)): ?>
    <div class="alert alert-info d-flex align-items-center" role="alert">
        <i class="bi bi-stars me-2"></i>
        <div>Your academic website has been created as a private draft. Review the settings below, then publish when you're ready.</div>
    </div>
    <?php endif; ?>

    <div class="row g-4">
        <!-- Settings column -->
        <div class="col-lg-7">
            <!-- Status + link -->
            <div class="card shadow-sm border-0 mb-4">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <h2 class="h6 mb-0">Status</h2>
                        <span id="statusBadge" class="badge <?= $isPublished ? 'bg-success' : 'bg-secondary' ?>">
                            <?= $isPublished ? 'Published' : 'Draft' ?>
                        </span>
                    </div>

                    <label class="form-label small text-muted">Your public link</label>
                    <div class="input-group mb-3">
                        <span class="input-group-text"><?= e(rtrim(APP_URL, '/')) ?>/u/</span>
                        <input type="text" class="form-control" id="slugInput" value="<?= e($slug) ?>"
                               pattern="[a-z0-9\-]+" maxlength="150" autocomplete="off">
                        <button class="btn btn-outline-secondary" type="button" id="copyLinkBtn" title="Copy link">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </div>
                    <div id="slugFeedback" class="small mb-3"></div>

                    <div class="d-flex flex-wrap gap-2">
                        <button type="button" class="btn btn-primary <?= $isPublished ? 'd-none' : '' ?>" id="publishBtn">
                            <i class="bi bi-rocket-takeoff me-1"></i> Publish
                        </button>
                        <button type="button" class="btn btn-outline-danger <?= $isPublished ? '' : 'd-none' ?>" id="unpublishBtn">
                            <i class="bi bi-eye-slash me-1"></i> Unpublish
                        </button>
                        <a href="<?= e(APP_URL . '/u/' . $slug) ?>" target="_blank" rel="noopener"
                           class="btn btn-outline-secondary <?= $isPublished ? '' : 'd-none' ?>" id="viewLiveBtn">
                            <i class="bi bi-box-arrow-up-right me-1"></i> View live
                        </a>
                    </div>
                </div>
            </div>

            <!-- Settings form -->
            <form id="websiteSettingsForm">
                <input type="hidden" name="<?= CSRF_TOKEN_NAME ?>" value="<?= e($csrf) ?>">

                <!-- Appearance -->
                <div class="card shadow-sm border-0 mb-4">
                    <div class="card-body">
                        <h2 class="h6 mb-3">Appearance</h2>
                        <div class="mb-3">
                            <label class="form-label small text-muted">Headline (optional)</label>
                            <input type="text" class="form-control" name="headline" maxlength="255"
                                   value="<?= e((string) ($website['headline'] ?? '')) ?>"
                                   placeholder="e.g. Researching machine learning for healthcare">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small text-muted">Profile image URL</label>
                            <input type="url" class="form-control" name="avatar_url" maxlength="1000"
                                   value="<?= e($currentAvatarUrl) ?>"
                                   placeholder="https://example.com/profile-photo.jpg">
                            <div class="form-text">
                                Google sign-in users are prefilled automatically. Paste another image URL here to override it, or leave blank to remove the image.
                            </div>
                            <?php if ($currentAvatarUrl !== ''): ?>
                                <div class="mt-2 d-flex align-items-center gap-2 small text-muted">
                                    <img src="<?= e($currentAvatarUrl) ?>" alt="Current profile image" class="rounded-circle border" width="40" height="40" style="object-fit:cover;" referrerpolicy="no-referrer">
                                    <span>Current website image</span>
                                </div>
                            <?php endif; ?>
                        </div>
                        <label class="form-label small text-muted">Style</label>
                        <div class="row g-2">
                            <?php foreach ($templateOptions as $key => $meta): ?>
                            <div class="col-12">
                                <label class="d-flex align-items-start gap-3 border rounded p-3 template-pick" style="cursor:pointer;">
                                    <input type="radio" name="template_key" value="<?= e($key) ?>" class="form-check-input mt-1"
                                           <?= $currentTemplate === $key ? 'checked' : '' ?>>
                                    <span class="flex-grow-1">
                                        <span class="d-flex align-items-center gap-2 mb-1">
                                            <span class="fw-semibold"><?= e($meta[0]) ?></span>
                                            <span class="d-flex gap-1">
                                                <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:<?= e($meta[2]) ?>;border:1px solid #ddd;" title="Accent color"></span>
                                                <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:<?= e($meta[3]) ?>;border:1px solid #ddd;" title="Background color"></span>
                                                <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:<?= e($meta[4]) ?>;border:1px solid #ddd;" title="Heading color"></span>
                                            </span>
                                        </span>
                                        <span class="small text-muted d-block"><?= e($meta[1]) ?></span>
                                    </span>
                                </label>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>

                <!-- Site Mode -->
                <div class="card shadow-sm border-0 mb-4">
                    <div class="card-body">
                        <h2 class="h6 mb-1">Site mode</h2>
                        <p class="small text-muted mb-3">Single page shows everything on one scrollable page. Multi-page splits content into About, Publications, Teaching, CV, and Contact pages with a top navigation bar.</p>
                        <div class="d-flex gap-3">
                            <label class="d-flex align-items-center gap-2" style="cursor:pointer;">
                                <input type="radio" name="site_mode" value="single" class="form-check-input" <?= ($website['site_mode'] ?? 'single') === 'single' ? 'checked' : '' ?>>
                                <span>
                                    <span class="fw-semibold d-block">Single page</span>
                                    <span class="small text-muted">All sections on one page</span>
                                </span>
                            </label>
                            <label class="d-flex align-items-center gap-2" style="cursor:pointer;">
                                <input type="radio" name="site_mode" value="multi" class="form-check-input" <?= ($website['site_mode'] ?? 'single') === 'multi' ? 'checked' : '' ?>>
                                <span>
                                    <span class="fw-semibold d-block">Multi-page</span>
                                    <span class="small text-muted">Separate pages with navigation</span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Sections -->
                <div class="card shadow-sm border-0 mb-4">
                    <div class="card-body">
                        <h2 class="h6 mb-1">Sections to show</h2>
                        <p class="small text-muted mb-3">Empty sections are hidden automatically.</p>
                        <div class="row g-2">
                            <?php foreach ($sectionLabels as $key => $label): ?>
                            <div class="col-sm-6">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" role="switch"
                                           id="sv_<?= e($key) ?>" name="section_visibility[<?= e($key) ?>]" value="1"
                                           <?= !empty($sv[$key]) ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="sv_<?= e($key) ?>"><?= e($label) ?></label>
                                </div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>

                <!-- Privacy -->
                <div class="card shadow-sm border-0 mb-4">
                    <div class="card-body">
                        <h2 class="h6 mb-1">Private details</h2>
                        <p class="small text-muted mb-3">These are hidden by default. Only enable what you're comfortable showing publicly.</p>
                        <?php
                        $privacy = [
                            'show_email'      => 'Show email address',
                            'show_phone'      => 'Show phone number',
                            'show_address'    => 'Show location / address',
                            'show_references' => 'Show references',
                        ];
                        foreach ($privacy as $key => $label): ?>
                        <div class="form-check form-switch mb-2">
                            <input class="form-check-input" type="checkbox" id="fv_<?= e($key) ?>"
                                   name="field_visibility[<?= e($key) ?>]" value="1" <?= !empty($fv[$key]) ? 'checked' : '' ?>>
                            <label class="form-check-label" for="fv_<?= e($key) ?>"><?= e($label) ?></label>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <!-- Download CV -->
                <div class="card shadow-sm border-0 mb-4">
                    <div class="card-body">
                        <h2 class="h6 mb-1">Downloadable CV</h2>
                        <p class="small text-muted mb-3">Let visitors download a compiled CV PDF.</p>
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" role="switch" id="sv_download_cv"
                                   name="section_visibility[download_cv]" value="1" <?= !empty($sv['download_cv']) ? 'checked' : '' ?>>
                            <label class="form-check-label" for="sv_download_cv">Show “Download CV” button</label>
                        </div>
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" role="switch" id="sv_contact_form"
                                   name="section_visibility[contact_form]" value="1" <?= !empty($sv['contact_form']) ? 'checked' : '' ?>>
                            <label class="form-check-label" for="sv_contact_form">Enable contact form</label>
                        </div>
                        <label class="form-label small text-muted">Which CV to offer</label>
                        <select class="form-select" name="source_cv_id">
                            <option value="0">Most recent compiled CV (automatic)</option>
                            <?php foreach ($cvOptions as $cv): ?>
                                <option value="<?= (int) $cv['id'] ?>" <?= (int) ($website['source_cv_id'] ?? 0) === $cv['id'] ? 'selected' : '' ?>>
                                    <?= e($cv['title']) ?><?= $cv['has_pdf'] ? '' : ' (no PDF yet)' ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <div class="d-flex gap-2 mb-4">
                    <button type="submit" class="btn btn-primary"><i class="bi bi-check2 me-1"></i> Save changes</button>
                    <span id="saveFeedback" class="align-self-center small text-muted"></span>
                </div>
            </form>
        </div>

        <!-- Live preview column -->
        <div class="col-lg-5">
            <div class="card shadow-sm border-0 position-sticky" style="top: 1rem;">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-center px-2 py-1">
                        <span class="small text-muted"><i class="bi bi-phone me-1"></i> Live preview</span>
                        <button type="button" class="btn btn-sm btn-link text-decoration-none" id="refreshPreview">
                            <i class="bi bi-arrow-clockwise"></i> Refresh
                        </button>
                    </div>
                    <div style="border:1px solid var(--bs-border-color);border-radius:10px;overflow:hidden;background:#fff;">
                        <iframe id="previewFrame" src="/website/preview" title="Website preview"
                                style="width:100%;height:680px;border:0;display:block;"></iframe>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
(function () {
    var tokenName = <?= json_encode(CSRF_TOKEN_NAME) ?>;
    var token = <?= json_encode($csrf) ?>;
    var basePublic = <?= json_encode(rtrim(APP_URL, '/') . '/u/') ?>;
    var form = document.getElementById('websiteSettingsForm');
    var slugInput = document.getElementById('slugInput');
    var slugFeedback = document.getElementById('slugFeedback');
    var saveFeedback = document.getElementById('saveFeedback');
    var statusBadge = document.getElementById('statusBadge');
    var publishBtn = document.getElementById('publishBtn');
    var unpublishBtn = document.getElementById('unpublishBtn');
    var viewLiveBtn = document.getElementById('viewLiveBtn');
    var previewFrame = document.getElementById('previewFrame');

    function refreshPreview() {
        previewFrame.contentWindow.location.reload();
    }
    document.getElementById('refreshPreview').addEventListener('click', refreshPreview);

    document.getElementById('copyLinkBtn').addEventListener('click', function () {
        var url = basePublic + slugInput.value;
        navigator.clipboard.writeText(url).then(function () {
            slugFeedback.className = 'small mb-3 text-success';
            slugFeedback.textContent = 'Link copied to clipboard.';
            fetch('/api/events/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_key: 'public_link_copied' })
            }).catch(function () {});
        });
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        saveFeedback.textContent = 'Saving…';
        slugInput.setAttribute('name', 'slug');
        var data = new URLSearchParams(new FormData(form));
        fetch('/website/settings', {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: data
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
              if (res.ok && res.j.success) {
                  saveFeedback.className = 'align-self-center small text-success';
                  saveFeedback.textContent = res.j.message || 'Saved.';
                  if (res.j.slug) { slugInput.value = res.j.slug; }
                  slugFeedback.textContent = '';
                  refreshPreview();
              } else {
                  saveFeedback.className = 'align-self-center small text-danger';
                  saveFeedback.textContent = (res.j && res.j.error) ? res.j.error : 'Could not save.';
              }
          }).catch(function () {
              saveFeedback.className = 'align-self-center small text-danger';
              saveFeedback.textContent = 'Network error.';
          });
    });

    function setStatus(published, publicUrl) {
        if (published) {
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = 'Published';
            publishBtn.classList.add('d-none');
            unpublishBtn.classList.remove('d-none');
            if (publicUrl) { viewLiveBtn.href = publicUrl; }
            viewLiveBtn.classList.remove('d-none');
        } else {
            statusBadge.className = 'badge bg-secondary';
            statusBadge.textContent = 'Draft';
            publishBtn.classList.remove('d-none');
            unpublishBtn.classList.add('d-none');
            viewLiveBtn.classList.add('d-none');
        }
    }

    function postStatus(url, published) {
        var body = tokenName + '=' + encodeURIComponent(token);
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (j.success) { setStatus(published, j.public_url); refreshPreview(); }
                else { alert(j.error || 'Action failed.'); }
            }).catch(function () { alert('Network error.'); });
    }

    publishBtn.addEventListener('click', function () { postStatus('/website/publish', true); });
    unpublishBtn.addEventListener('click', function () { postStatus('/website/unpublish', false); });
})();
</script>
