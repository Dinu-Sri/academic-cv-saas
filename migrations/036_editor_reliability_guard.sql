-- Migration 036: Editor reliability guard cron + settings

INSERT IGNORE INTO cron_jobs (job_key, label, schedule, script_path, is_enabled) VALUES
('editor_reliability_guard', 'Editor Reliability Guard', '*/15 * * * *', 'cron/editor_reliability_guard.php', 1);

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('editor_guard_enabled', '1'),
('editor_guard_window_minutes', '30'),
('editor_guard_js_error_threshold', '8'),
('editor_guard_alert_cooldown_minutes', '60'),
('editor_guard_alert_emails', ''),
('editor_guard_last_alert_at', '');
