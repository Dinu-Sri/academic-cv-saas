-- Migration 048: User Marketing Preferences & Consent Tracking
-- Stores per-user marketing opt-in/out preferences and cookie consent choices
-- for GDPR (EU), UK GDPR, and CCPA (California) compliance.
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS user_marketing_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    marketing_emails TINYINT(1) DEFAULT 0,
    marketing_sms TINYINT(1) DEFAULT 0,
    product_updates TINYINT(1) DEFAULT 1,
    cookie_consent JSON NULL,
    terms_accepted_at DATETIME NULL,
    privacy_accepted_at DATETIME NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_prefs (user_id)
) ENGINE=InnoDB;

-- Insert default preferences for existing users (idempotent)
INSERT IGNORE INTO user_marketing_preferences (user_id, marketing_emails, marketing_sms, product_updates)
SELECT id, 0, 0, 1 FROM users;
