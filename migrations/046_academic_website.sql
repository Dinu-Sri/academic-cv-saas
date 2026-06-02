-- Migration 046: CVScholar Academic Website
-- One public, mobile-first academic website per user, auto-populated from the
-- CENTRAL profile (users.personal_info + user_entries + verified publications).
-- Draft by default; the user clicks Publish. Includes a contact form whose
-- submissions are stored here and emailed to the website owner.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS (no transactions; DDL auto-commits).

CREATE TABLE IF NOT EXISTS academic_websites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    slug VARCHAR(150) NOT NULL,
    status ENUM('draft','published') DEFAULT 'draft',
    template_key VARCHAR(50) DEFAULT 'elegant',
    headline VARCHAR(255) NULL,
    section_visibility JSON NULL,
    field_visibility JSON NULL,
    source_cv_id INT NULL,
    view_count INT DEFAULT 0,
    last_viewed_at DATETIME NULL,
    published_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_cv_id) REFERENCES cv_profiles(id) ON DELETE SET NULL,
    UNIQUE KEY unique_website_user (user_id),
    UNIQUE KEY unique_website_slug (slug),
    INDEX idx_aw_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS website_contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    website_id INT NOT NULL,
    user_id INT NOT NULL,
    visitor_name VARCHAR(150) NOT NULL,
    visitor_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NULL,
    message TEXT NOT NULL,
    ip_hash CHAR(64) NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (website_id) REFERENCES academic_websites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_wcm_website (website_id),
    INDEX idx_wcm_ip_created (ip_hash, created_at)
) ENGINE=InnoDB;
