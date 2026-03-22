-- Migration 005: Add subscriptions table for plan tracking
-- Plans: free, pro, enterprise

CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    price_cents INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    payment_method VARCHAR(50) NULL,
    payment_id VARCHAR(255) NULL,
    starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_plan (user_id, plan),
    INDEX idx_status (status)
) ENGINE=InnoDB;
