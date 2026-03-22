-- 001_initial_schema.sql
-- Initial database schema for CVScholar
-- This creates all tables from scratch (for fresh deployments)

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    title VARCHAR(100),
    affiliation VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    is_admin TINYINT(1) DEFAULT 0,
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_expires_at DATETIME NULL,
    google_scholar_id VARCHAR(255) NULL,
    orcid_id VARCHAR(255) NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    preview_image VARCHAR(500),
    latex_header TEXT NOT NULL,
    latex_footer TEXT NOT NULL,
    is_premium TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    style_config JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS template_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL,
    section_key VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    latex_code TEXT NOT NULL,
    section_order INT DEFAULT 0,
    is_required TINYINT(1) DEFAULT 0,
    is_repeatable TINYINT(1) DEFAULT 1,
    fields_schema JSON NOT NULL,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    UNIQUE KEY unique_template_section (template_id, section_key),
    INDEX idx_template (template_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cv_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    template_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_default TINYINT(1) DEFAULT 0,
    personal_info JSON,
    last_compiled_at DATETIME NULL,
    pdf_path VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates(id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cv_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    section_key VARCHAR(100) NOT NULL,
    section_order INT DEFAULT 0,
    is_visible TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES cv_profiles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_profile_section (profile_id, section_key),
    INDEX idx_profile (profile_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cv_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    section_id INT NOT NULL,
    entry_order INT DEFAULT 0,
    data JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES cv_sections(id) ON DELETE CASCADE,
    INDEX idx_section (section_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS publications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    authors TEXT,
    year INT,
    venue VARCHAR(500),
    doi VARCHAR(255),
    url VARCHAR(500),
    citation_count INT DEFAULT 0,
    source VARCHAR(50) DEFAULT 'manual',
    external_id VARCHAR(255),
    is_verified TINYINT(1) DEFAULT 0,
    is_included TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_source (source)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    subscription_plan VARCHAR(50),
    subscription_months INT DEFAULT 1,
    gateway_response JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    items_synced INT DEFAULT 0,
    error_message TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB;
