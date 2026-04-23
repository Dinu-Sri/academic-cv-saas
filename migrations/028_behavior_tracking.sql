-- Migration 028: Detailed behavior tracking (Clarity-like timeline)

CREATE TABLE IF NOT EXISTS behavior_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL UNIQUE,
    user_id INT NULL,
    started_at DATETIME NOT NULL,
    last_event_at DATETIME NOT NULL,
    pageviews INT NOT NULL DEFAULT 0,
    total_events INT NOT NULL DEFAULT 0,
    last_path VARCHAR(255) NULL,
    user_agent VARCHAR(255) NULL,
    ip_hash CHAR(64) NULL,
    metadata JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_behavior_sessions_user_time (user_id, started_at),
    INDEX idx_behavior_sessions_last_event (last_event_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS behavior_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    session_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    path VARCHAR(255) NULL,
    selector VARCHAR(255) NULL,
    duration_ms INT NULL,
    scroll_depth TINYINT UNSIGNED NULL,
    frustration_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
    metadata JSON NULL,
    event_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_behavior_events_user_time (user_id, event_at),
    INDEX idx_behavior_events_session_time (session_id, event_at),
    INDEX idx_behavior_events_type_time (event_type, event_at),
    INDEX idx_behavior_events_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('behavior_tracking_enabled', '0'),
('behavior_tracking_mode', 'timeline'),
('behavior_retention_days', '180'),
('behavior_mask_inputs', '1'),
('behavior_sampling_rate', '100');
