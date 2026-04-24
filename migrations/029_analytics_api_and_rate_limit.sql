-- Migration 029: Analytics API access + rate limiting

CREATE TABLE IF NOT EXISTS api_rate_limits (
    api_scope VARCHAR(50) NOT NULL,
    key_hash CHAR(64) NOT NULL,
    window_start DATETIME NOT NULL,
    request_count INT NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (api_scope, key_hash, window_start),
    INDEX idx_rate_window (window_start)
) ENGINE=InnoDB;

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('analytics_api_enabled', '1'),
('analytics_api_key_hash', ''),
('analytics_api_rate_limit_per_hour', '240');