-- Migration 037: Draft stall detector cron registry

INSERT IGNORE INTO cron_jobs (job_key, label, schedule, script_path, is_enabled) VALUES
('draft_stall_detector', 'Draft Stall Detector (24h no compile)', '10 * * * *', 'cron/draft_stall_detector.php', 1);
