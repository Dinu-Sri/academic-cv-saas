-- Migration 018: Support Ticket System
-- Tables for support tickets, bug reports, feature requests with threaded replies

CREATE TABLE IF NOT EXISTS support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ticket_number VARCHAR(20) NOT NULL,
    type ENUM('support', 'bug', 'feature') NOT NULL DEFAULT 'support',
    subject VARCHAR(255) NOT NULL,
    status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
    has_unread_admin_reply TINYINT(1) NOT NULL DEFAULT 0,
    has_unread_user_reply TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_ticket_number (ticket_number),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ticket_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    is_admin_reply TINYINT(1) NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ticket_id (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Safely add unread columns if table was created without them (MySQL 8.0 compat)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_tickets' AND COLUMN_NAME = 'has_unread_admin_reply');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE support_tickets ADD COLUMN has_unread_admin_reply TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_tickets' AND COLUMN_NAME = 'has_unread_user_reply');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE support_tickets ADD COLUMN has_unread_user_reply TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
