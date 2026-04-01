<!-- Breadcrumb -->
<div class="container mk-breadcrumb">
    <a href="<?= APP_URL ?>/">Home</a> <span class="mx-2 text-muted">/</span> <span class="text-muted">Contact Us</span>
</div>

<section class="mk-section pt-4">
    <div class="container">
        <div class="text-center mb-5">
            <h1 class="mk-section-title">Get in Touch</h1>
            <p class="mk-section-subtitle">Have a question about CVScholar? Need help with your academic CV? We'd love to hear from you.</p>
        </div>

        <div class="row g-5 justify-content-center">
            <!-- Contact Form -->
            <div class="col-lg-7">
                <div class="mk-contact-card">
                    <form method="POST" action="<?= APP_URL ?>/contact">
                        <?= Auth::csrfField() ?>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label for="name" class="form-label fw-semibold">Your Name <span class="text-danger">*</span></label>
                                <input type="text" class="form-control form-control-lg" id="name" name="name" required placeholder="Dr. Jane Smith" maxlength="100">
                            </div>
                            <div class="col-md-6">
                                <label for="email" class="form-label fw-semibold">Email Address <span class="text-danger">*</span></label>
                                <input type="email" class="form-control form-control-lg" id="email" name="email" required placeholder="you@university.edu" maxlength="200">
                            </div>
                            <div class="col-12">
                                <label for="subject" class="form-label fw-semibold">Subject <span class="text-danger">*</span></label>
                                <select class="form-select form-select-lg" id="subject" name="subject" required>
                                    <option value="">Select a topic...</option>
                                    <option value="General Inquiry">General Inquiry</option>
                                    <option value="Technical Support">Technical Support</option>
                                    <option value="Feature Request">Feature Request</option>
                                    <option value="Enterprise / Institutional Plan">Enterprise / Institutional Plan</option>
                                    <option value="Bug Report">Bug Report</option>
                                    <option value="Partnership">Partnership</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div class="col-12">
                                <label for="message" class="form-label fw-semibold">Message <span class="text-danger">*</span></label>
                                <textarea class="form-control form-control-lg" id="message" name="message" rows="5" required placeholder="Tell us how we can help..." maxlength="5000"></textarea>
                            </div>
                            <div class="col-12">
                                <button type="submit" class="btn btn-primary btn-lg w-100 fw-semibold">
                                    <i class="bi bi-send me-2"></i>Send Message
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Contact Info -->
            <div class="col-lg-4">
                <div class="mb-4">
                    <h5 class="fw-bold mb-3"><i class="bi bi-envelope me-2 text-primary"></i>Email Us</h5>
                    <p class="text-muted">For general inquiries and support:</p>
                    <a href="mailto:info@clossyan.com" class="fw-semibold">info@clossyan.com</a>
                </div>
                <div class="mb-4">
                    <h5 class="fw-bold mb-3"><i class="bi bi-clock me-2 text-primary"></i>Response Time</h5>
                    <p class="text-muted">We aim to respond within 24 hours on business days. Pro users get priority support.</p>
                </div>
                <div class="mb-4">
                    <h5 class="fw-bold mb-3"><i class="bi bi-building me-2 text-primary"></i>Organization</h5>
                    <p class="text-muted mb-1">Clossyan Technologies (Pvt) Ltd</p>
                </div>
                <div class="p-4 rounded-3" style="background:#e8f0fe;">
                    <h6 class="fw-bold mb-2" style="color:#1B2A4A;"><i class="bi bi-lightbulb me-2 text-primary"></i>Quick Help</h6>
                    <p class="small mb-2" style="color:#374151;">Already have an account? Use the in-app support ticket system for faster responses.</p>
                    <a href="<?= APP_URL ?>/login" class="btn btn-outline-primary btn-sm">Log In to Your Account</a>
                </div>
            </div>
        </div>
    </div>
</section>
