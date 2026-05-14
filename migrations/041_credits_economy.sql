-- Migration 041: Credits economy foundation
-- Adds user credit balances and an immutable credit ledger.

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'credit_balance');
SET @sql = IF(@col = 0, 'ALTER TABLE users ADD COLUMN credit_balance INT NOT NULL DEFAULT 0 AFTER subscription_expires_at', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS credit_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    source VARCHAR(100) NOT NULL,
    reference_type VARCHAR(100) NULL,
    reference_id VARCHAR(100) NULL,
    idempotency_key VARCHAR(190) NOT NULL,
    metadata JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_idempotency_key (idempotency_key),
    INDEX idx_credit_user (user_id),
    INDEX idx_credit_type (type),
    INDEX idx_credit_source (source)
) ENGINE=InnoDB;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'credit_amount');
SET @sql = IF(@col = 0, 'ALTER TABLE payments ADD COLUMN credit_amount INT NULL AFTER billing_cycle', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'purchase_type');
SET @sql = IF(@col = 0, 'ALTER TABLE payments ADD COLUMN purchase_type VARCHAR(50) NULL AFTER credit_amount', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    source,
    reference_type,
    reference_id,
    idempotency_key,
    metadata
)
SELECT
    id,
    CASE WHEN subscription_plan IN ('starter', 'pro', 'enterprise') THEN 250 ELSE 50 END,
    CASE WHEN subscription_plan IN ('starter', 'pro', 'enterprise') THEN 250 ELSE 50 END,
    'grant',
    'initial_migration',
    'user',
    CAST(id AS CHAR),
    CONCAT('initial_credits_user_', id),
    JSON_OBJECT('previous_plan', subscription_plan)
FROM users;

UPDATE users u
LEFT JOIN (
    SELECT user_id, SUM(amount) AS balance
    FROM credit_transactions
    GROUP BY user_id
) ct ON ct.user_id = u.id
SET
    u.credit_balance = COALESCE(ct.balance, 0),
    u.subscription_plan = 'free',
    u.subscription_expires_at = NULL;
