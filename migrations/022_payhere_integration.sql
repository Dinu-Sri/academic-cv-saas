-- Migration 022: PayHere payment gateway integration
-- Adds site_settings table for storing PayHere credentials
-- Updates payments table for PayHere-specific fields

-- =============================================
-- PART 1: Site Settings table (key-value store for admin config)
-- =============================================

CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Seed PayHere settings with empty defaults
INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('payhere_merchant_id', ''),
('payhere_merchant_secret', ''),
('payhere_app_id', ''),
('payhere_app_secret', ''),
('payhere_sandbox', '1'),
('payhere_currency', 'USD');

-- =============================================
-- PART 2: Add PayHere fields to payments table
-- MySQL 8.0 compatible (no IF NOT EXISTS on ALTER TABLE)
-- =============================================

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payhere_payment_id');
SET @sql = IF(@col = 0, 'ALTER TABLE payments ADD COLUMN payhere_payment_id VARCHAR(255) NULL AFTER transaction_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'billing_cycle');
SET @sql = IF(@col = 0, 'ALTER TABLE payments ADD COLUMN billing_cycle VARCHAR(20) NULL AFTER subscription_months', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'refund_status');
SET @sql = IF(@col = 0, 'ALTER TABLE payments ADD COLUMN refund_status VARCHAR(50) NULL AFTER gateway_response', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'refund_amount');
SET @sql = IF(@col = 0, 'ALTER TABLE payments ADD COLUMN refund_amount DECIMAL(10,2) NULL AFTER refund_status', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'refunded_at');
SET @sql = IF(@col = 0, 'ALTER TABLE payments ADD COLUMN refunded_at DATETIME NULL AFTER refund_amount', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'refund_note');
SET @sql = IF(@col = 0, 'ALTER TABLE payments ADD COLUMN refund_note TEXT NULL AFTER refunded_at', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_payhere_payment_id');
SET @sql = IF(@idx = 0, 'ALTER TABLE payments ADD INDEX idx_payhere_payment_id (payhere_payment_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
