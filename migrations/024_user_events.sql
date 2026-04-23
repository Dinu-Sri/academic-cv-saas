-- Migration 024: User behavior event tracking for retention analytics

CREATE TABLE IF NOT EXISTS user_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    event_key VARCHAR(100) NOT NULL,
    metadata JSON NULL,
    ip_hash CHAR(64) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_event_created (event_key, created_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;
