-- Migration 026: Cron job registry table for monitoring and toggling
CREATE TABLE IF NOT EXISTS cron_jobs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_key VARCHAR(100) NOT NULL,
    label VARCHAR(200) NOT NULL,
    schedule VARCHAR(100) NOT NULL COMMENT 'Cron expression e.g. 0 * * * *',
    script_path VARCHAR(500) NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    last_run_at DATETIME NULL DEFAULT NULL,
    last_status VARCHAR(20) NULL DEFAULT NULL COMMENT 'running|success|failed',
    last_output TEXT NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_job_key (job_key)
) ENGINE=InnoDB;

INSERT IGNORE INTO cron_jobs (job_key, label, schedule, script_path, is_enabled) VALUES
('expire_subscriptions', 'Expire Subscriptions', '0 * * * *', 'cron/expire_subscriptions.php', 1),
('email_retention', 'Retention Emails (Day-3 & Day-7)', '30 8 * * *', 'cron/email_retention.php', 1);
