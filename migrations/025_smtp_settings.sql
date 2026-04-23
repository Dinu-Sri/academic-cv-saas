-- Migration 025: SMTP email configuration settings
-- Adds configurable SMTP credentials for transactional email delivery

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('smtp_enabled', '0'),
('smtp_host', ''),
('smtp_port', '465'),
('smtp_username', ''),
('smtp_password', ''),
('smtp_from_address', ''),
('smtp_from_name', 'CVScholar'),
('smtp_encryption', 'ssl');
