<?php
$pageTitle = 'Templates';
ob_start();
?>
<div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="fw-bold mb-1">Template Gallery</h2>
            <p class="text-muted mb-0">Choose a template to start building your CV.</p>
        </div>
    </div>

    <div class="row g-4">
        <?php foreach ($templates as $template): ?>
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm">
                <div class="card-body text-center py-4">
                    <div class="mb-3">
                        <i class="bi bi-file-text display-3 text-primary"></i>
                    </div>
                    <h5 class="fw-bold"><?= e($template['name']) ?></h5>
                    <p class="text-muted"><?= e($template['description']) ?></p>
                    <?php if ($template['is_premium']): ?>
                        <span class="badge bg-warning mb-2">Pro</span>
                    <?php else: ?>
                        <span class="badge bg-success mb-2">Free</span>
                    <?php endif; ?>
                </div>
                <div class="card-footer bg-transparent text-center py-3">
                    <div class="d-flex gap-2 mb-2">
                        <button type="button" class="btn btn-outline-secondary btn-sm flex-fill" onclick="openDemoPreview(<?= $template['id'] ?>, '<?= e($template['name']) ?>')">
                            <i class="bi bi-file-earmark-pdf me-1"></i>Preview Design
                        </button>
                        <a href="<?= APP_URL ?>/templates/preview/<?= $template['id'] ?>" class="btn btn-outline-primary btn-sm flex-fill">
                            <i class="bi bi-layout-text-sidebar me-1"></i>View Sections
                        </a>
                    </div>
                    <?php if ($template['is_premium'] && $userPlan === 'free'): ?>
                        <a href="<?= APP_URL ?>/plans" class="btn btn-warning btn-sm w-100">
                            <i class="bi bi-star-fill me-1"></i>Upgrade to Pro
                        </a>
                    <?php else: ?>
                        <a href="<?= APP_URL ?>/cv/create?template=<?= $template['id'] ?>" class="btn btn-primary btn-sm w-100">
                            <i class="bi bi-plus-lg me-1"></i>Use Template
                        </a>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</div>

<!-- Demo PDF Preview Modal -->
<div class="modal fade" id="demoPreviewModal" tabindex="-1" aria-labelledby="demoPreviewModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered" style="max-width: 900px;">
        <div class="modal-content" style="height: 85vh;">
            <div class="modal-header py-2">
                <h6 class="modal-title" id="demoPreviewModalLabel">Template Preview</h6>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0 d-flex align-items-center justify-content-center" style="flex: 1; min-height: 0;">
                <div id="demoLoadingSpinner" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted mt-2 mb-0">Generating preview...</p>
                </div>
                <iframe id="demoPreviewFrame" style="width: 100%; height: 100%; border: none; display: none;"></iframe>
            </div>
        </div>
    </div>
</div>

<script>
let demoBlobUrl = null;
function openDemoPreview(templateId, templateName) {
    const modal = new bootstrap.Modal(document.getElementById('demoPreviewModal'));
    document.getElementById('demoPreviewModalLabel').textContent = templateName + ' — Sample CV Preview';
    const frame = document.getElementById('demoPreviewFrame');
    const spinner = document.getElementById('demoLoadingSpinner');

    frame.style.display = 'none';
    spinner.style.display = 'block';
    frame.src = 'about:blank';
    if (demoBlobUrl) { URL.revokeObjectURL(demoBlobUrl); demoBlobUrl = null; }

    modal.show();

    fetch('<?= APP_URL ?>/templates/demo/' + templateId)
        .then(r => r.json())
        .then(data => {
            if (!data.pdf_base64) throw new Error('No PDF data');
            var binary = atob(data.pdf_base64);
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            var blob = new Blob([bytes], { type: 'application/pdf' });
            demoBlobUrl = URL.createObjectURL(blob);
            frame.src = demoBlobUrl + '#toolbar=0&navpanes=0';
            frame.onload = function() {
                spinner.style.display = 'none';
                frame.style.display = 'block';
            };
        })
        .catch(() => {
            spinner.innerHTML = '<p class="text-danger">Failed to load preview.</p>';
        });
}

document.getElementById('demoPreviewModal').addEventListener('hidden.bs.modal', function() {
    const frame = document.getElementById('demoPreviewFrame');
    frame.src = 'about:blank';
    if (demoBlobUrl) { URL.revokeObjectURL(demoBlobUrl); demoBlobUrl = null; }
});
</script>
<?php
$content = ob_get_clean();
include TEMPLATE_PATH . '/layouts/main.php';
