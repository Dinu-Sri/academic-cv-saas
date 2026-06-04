-- Migration 048: User Marketing Preferences & Consent Tracking
-- Stores per-user marketing opt-in/out preferences and cookie consent choices
-- for GDPR (EU), UK GDPR, and CCPA (California) compliance.
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS user_marketing_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    marketing_emails TINYINT(1) DEFAULT 1,
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
SELECT id, 1, 0, 1 FROM users;

-- Update existing rows: set email marketing ON if previously defaulted to 0
UPDATE user_marketing_preferences SET marketing_emails = 1 WHERE marketing_emails = 0;
