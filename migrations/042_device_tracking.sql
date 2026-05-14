-- Migration 042: Device tracking at login
-- Adds last_device and last_device_ua columns to users table
-- Values for last_device: 'mobile', 'tablet', 'desktop'

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_device ENUM('mobile','tablet','desktop') DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS last_device_ua VARCHAR(500) DEFAULT NULL;
