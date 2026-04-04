-- Migration 023: Admin-configurable pricing for Starter and Pro plans
-- Prices stored in cents (e.g., 500 = $5.00)

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('pricing_starter_onetime', '500'),
('pricing_pro_monthly', '200'),
('pricing_pro_annual', '1900');
