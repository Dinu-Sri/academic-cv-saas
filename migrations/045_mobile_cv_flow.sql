-- Migration 045: Mobile CV flow ("Start on mobile, finish on laptop")
-- Tracks mobile-originated CV drafts, extraction/PDF status, the secure
-- desktop continuation token, and handoff CTA timestamps for automation.
--
-- The draft CV itself lives in cv_profiles/cv_sections/cv_entries (reused).
-- continuation_token does NOT expire (continuation_token_expires_at kept
-- nullable for future use but left NULL = never expires).

CREATE TABLE IF NOT EXISTS mobile_cv_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cv_profile_id INT NULL,
    user_id INT NOT NULL,
    source_device VARCHAR(20) DEFAULT 'mobile',
    started_from_mobile TINYINT(1) DEFAULT 1,
    mobile_flow_type ENUM('uploaded_cv','manual_start') NOT NULL,
    uploaded_cv_file_path VARCHAR(500) NULL,
    extraction_status ENUM('pending','success','failed') DEFAULT 'pending',
    pdf_generation_status ENUM('pending','success','failed') DEFAULT 'pending',
    continuation_token CHAR(64) NULL,
    continuation_token_expires_at DATETIME NULL,
    desktop_opened_at DATETIME NULL,
    emailed_link_at DATETIME NULL,
    whatsapp_clicked_at DATETIME NULL,
    copied_link_at DATETIME NULL,
    first_downloaded_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cv_profile_id) REFERENCES cv_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_continuation_token (continuation_token),
    INDEX idx_user (user_id),
    INDEX idx_profile (cv_profile_id)
) ENGINE=InnoDB;
