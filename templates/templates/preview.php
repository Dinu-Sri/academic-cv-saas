<?php
$pageTitle = 'Preview - ' . e($template['name']);
ob_start();

// Group sections into columns for a balanced layout
$totalSections = count($sections);
$midpoint = ceil($totalSections / 2);
$col1 = array_slice($sections, 0, $midpoint);
$col2 = array_slice($sections, $midpoint);
?>
<div class="container py-4" style="max-width: 900px;">
    <div class="mb-4">
        <a href="<?= APP_URL ?>/templates" class="btn btn-outline-secondary btn-sm">
            <i class="bi bi-arrow-left me-1"></i>Back to Templates
        </a>
    </div>

    <!-- Template Header Card -->
    <div class="card shadow-sm border-0 mb-4">
        <div class="card-body text-center py-5" style="background: linear-gradient(135deg, #f8f9fd 0%, #eef2f9 100%); border-radius: 0.5rem;">
            <div class="mb-3">
                <?php if ($template['is_premium']): ?>
                    <span class="badge bg-warning text-dark mb-2"><i class="bi bi-star-fill me-1"></i>Pro</span>
                <?php else: ?>
                    <span class="badge bg-success mb-2">Free</span>
                <?php endif; ?>
            </div>
            <h2 class="fw-bold mb-2"><?= e($template['name']) ?></h2>
            <p class="text-muted mb-3 mx-auto" style="max-width: 500px;"><?= e($template['description']) ?></p>
            <div class="d-flex justify-content-center gap-2 flex-wrap">
                <span class="text-muted small"><i class="bi bi-grid-3x3-gap me-1"></i><?= $totalSections ?> sections</span>
                <span class="text-muted small">|</span>
                <span class="text-muted small"><i class="bi bi-card-text me-1"></i><?= array_sum(array_map(fn($s) => count($s['fields_schema']), $sections)) ?> total fields</span>
            </div>
        </div>
    </div>

    <!-- Sections Grid -->
    <h5 class="fw-bold mb-3"><i class="bi bi-layout-text-sidebar-reverse me-2"></i>Sections Included</h5>
    <div class="row g-3 mb-4">
        <div class="col-md-6">
            <?php foreach ($col1 as $section): ?>
            <div class="card mb-2 border-0 shadow-sm">
                <div class="card-body py-2 px-3 d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <?php if ($section['is_required']): ?>
                            <i class="bi bi-check-circle-fill text-primary me-2" title="Required"></i>
                        <?php else: ?>
                            <i class="bi bi-circle text-muted me-2" style="opacity:0.4;"></i>
                        <?php endif; ?>
                        <span class="fw-medium"><?= e($section['display_name']) ?></span>
                    </div>
                    <span class="badge bg-light text-muted"><?= count($section['fields_schema']) ?> fields</span>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        <div class="col-md-6">
            <?php foreach ($col2 as $section): ?>
            <div class="card mb-2 border-0 shadow-sm">
                <div class="card-body py-2 px-3 d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <?php if ($section['is_required']): ?>
                            <i class="bi bi-check-circle-fill text-primary me-2" title="Required"></i>
                        <?php else: ?>
                            <i class="bi bi-circle text-muted me-2" style="opacity:0.4;"></i>
                        <?php endif; ?>
                        <span class="fw-medium"><?= e($section['display_name']) ?></span>
                    </div>
                    <span class="badge bg-light text-muted"><?= count($section['fields_schema']) ?> fields</span>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- CTA -->
    <div class="text-center py-3 d-flex justify-content-center gap-2">
        <button type="button" class="btn btn-outline-secondary btn-lg px-4" onclick="openDemoPreview(<?= $template['id'] ?>, '<?= e($template['name']) ?>')">
            <i class="bi bi-file-earmark-pdf me-1"></i>Preview Design
        </button>
        <a href="<?= APP_URL ?>/cv/create?template=<?= $template['id'] ?>" class="btn btn-primary btn-lg px-5">
            <i class="bi bi-plus-lg me-1"></i>Create CV with this Template
        </a>
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
