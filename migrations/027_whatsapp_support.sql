-- Migration 027: WhatsApp floating support button configuration
INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('whatsapp_enabled', '0'),
('whatsapp_phone', ''),
('whatsapp_agent_name', 'Support'),
('whatsapp_show_for_plans', '["free","starter","pro","enterprise"]'),
('whatsapp_questions', '["Need help getting started?","Want to suggest a feature?","Need to change something in your CV?","How do I import from ORCID or Google Scholar?","Need help with a setting?"]');
