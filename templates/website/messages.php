<?php
/**
 * Website contact-message inbox (owner view).
 * Rendered inside templates/layouts/main.php via $content.
 *
 * Vars: $messages (array)
 */
?>
<div class="container py-4" style="max-width: 860px;">
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div>
            <h1 class="h3 mb-1"><i class="bi bi-inbox me-2 text-primary"></i>Website Messages</h1>
            <p class="text-muted mb-0">Messages people sent through your academic website's contact form.</p>
        </div>
        <a href="/website" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-1"></i> Back to website</a>
    </div>

    <?php if (empty($messages)): ?>
        <div class="card border-0 shadow-sm">
            <div class="card-body text-center py-5">
                <i class="bi bi-envelope-open text-muted" style="font-size: 2.5rem;"></i>
                <p class="text-muted mt-3 mb-0">No messages yet.</p>
            </div>
        </div>
    <?php else: ?>
        <div class="vstack gap-3">
            <?php foreach ($messages as $msg): ?>
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                            <div>
                                <span class="fw-semibold"><?= e((string) ($msg['visitor_name'] ?? '')) ?></span>
                                <a href="mailto:<?= e((string) ($msg['visitor_email'] ?? '')) ?>" class="text-decoration-none ms-1 small">
                                    &lt;<?= e((string) ($msg['visitor_email'] ?? '')) ?>&gt;
                                </a>
                            </div>
                            <span class="small text-muted">
                                <?= e(date('M j, Y · g:i A', strtotime((string) ($msg['created_at'] ?? 'now')))) ?>
                            </span>
                        </div>
                        <?php if (!empty($msg['subject'])): ?>
                            <div class="fw-semibold mb-1"><?= e((string) $msg['subject']) ?></div>
                        <?php endif; ?>
                        <p class="mb-3" style="white-space: pre-line;"><?= e((string) ($msg['message'] ?? '')) ?></p>
                        <a class="btn btn-sm btn-outline-primary"
                           href="mailto:<?= e((string) ($msg['visitor_email'] ?? '')) ?>?subject=<?= e(rawurlencode('Re: ' . (string) ($msg['subject'] ?? 'Your message'))) ?>">
                            <i class="bi bi-reply me-1"></i> Reply
                        </a>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>
