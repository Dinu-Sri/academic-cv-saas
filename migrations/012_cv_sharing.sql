-- Migration 012: CV sharing feature
-- Public shareable links with view tracking and OG metadata

CREATE TABLE IF NOT EXISTS cv_shares (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    user_id INT NOT NULL,
    share_slug VARCHAR(100) NOT NULL UNIQUE,
    is_active TINYINT(1) DEFAULT 1,
    view_count INT DEFAULT 0,
    last_viewed_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (profile_id) REFERENCES cv_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_profile_share (profile_id),
    INDEX idx_slug (share_slug),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- Feature flag for CV sharing
INSERT IGNORE INTO features (feature_key, feature_name, category, description) VALUES
('cv_sharing', 'CV Sharing', 'core', 'Share CVs via public short links with view tracking');

-- Free: disabled, Pro: enabled, Enterprise: enabled
INSERT IGNORE INTO plan_features (plan, feature_key, is_enabled) VALUES
('free', 'cv_sharing', 0),
('pro', 'cv_sharing', 1),
('enterprise', 'cv_sharing', 1);
