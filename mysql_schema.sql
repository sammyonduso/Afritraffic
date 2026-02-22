-- Traffic Exchange Platform - MySQL Database Schema Design

-- 1. Users Table
-- Stores core user identity and authentication data.
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    referral_code VARCHAR(10) UNIQUE,
    referred_by INT UNSIGNED DEFAULT NULL,
    status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_referral_code (referral_code),
    CONSTRAINT fk_referred_by FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 2. Wallets Table
-- Stores current balances. Separated from users for better locking and auditing.
CREATE TABLE wallets (
    user_id INT UNSIGNED PRIMARY KEY,
    points_balance DECIMAL(18, 4) DEFAULT 0.0000,
    earnings_available DECIMAL(18, 2) DEFAULT 0.00,
    earnings_locked DECIMAL(18, 2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Websites Table
-- Sites submitted by users to receive traffic.
CREATE TABLE websites (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_id INT UNSIGNED NOT NULL,
    url TEXT NOT NULL,
    points_per_view DECIMAL(10, 2) DEFAULT 1.00,
    daily_limit INT DEFAULT 0, -- 0 for unlimited
    current_views_today INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_owner (owner_id),
    CONSTRAINT fk_website_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Traffic Sessions Table
-- Tracks every view event.
CREATE TABLE traffic_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    viewer_id INT UNSIGNED NOT NULL,
    website_id INT UNSIGNED NOT NULL,
    duration_seconds INT UNSIGNED NOT NULL,
    points_earned DECIMAL(10, 4) NOT NULL,
    ip_address VARBINARY(16) NOT NULL, -- Supports IPv4 and IPv6
    user_agent TEXT,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_viewer_date (viewer_id, viewed_at),
    INDEX idx_website_date (website_id, viewed_at),
    INDEX idx_ip_date (ip_address, viewed_at),
    CONSTRAINT fk_session_viewer FOREIGN KEY (viewer_id) REFERENCES users(id),
    CONSTRAINT fk_session_website FOREIGN KEY (website_id) REFERENCES websites(id)
) ENGINE=InnoDB;

-- 5. Points Ledger Table
-- Audit trail for all point movements (earning, spending, bonuses).
CREATE TABLE points_ledger (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(18, 4) NOT NULL, -- Positive for credit, negative for debit
    transaction_type ENUM('view_earn', 'site_spend', 'referral_bonus', 'admin_adj', 'conversion') NOT NULL,
    reference_id BIGINT UNSIGNED DEFAULT NULL, -- e.g., traffic_session_id
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_type (user_id, transaction_type),
    CONSTRAINT fk_points_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- 6. Earnings Ledger Table
-- Implements the 15-day unlock logic.
CREATE TABLE earnings_ledger (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    status ENUM('locked', 'available', 'withdrawn', 'cancelled') DEFAULT 'locked',
    source ENUM('ad_revenue_share', 'referral_comm', 'bonus') NOT NULL,
    unlock_at TIMESTAMP NOT NULL, -- Set to CURRENT_TIMESTAMP + 15 DAYS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_unlock_status (unlock_at, status),
    INDEX idx_user_status (user_id, status),
    CONSTRAINT fk_earnings_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- 7. Adsterra Revenue Table
-- Tracks revenue data imported from Adsterra API.
CREATE TABLE adsterra_revenue_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    revenue DECIMAL(18, 4) NOT NULL,
    impressions INT UNSIGNED NOT NULL,
    clicks INT UNSIGNED DEFAULT 0,
    ctr DECIMAL(5, 2) DEFAULT 0.00,
    cpm DECIMAL(10, 4) DEFAULT 0.00,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_date (date)
) ENGINE=InnoDB;

-- 8. Withdrawal Requests Table
CREATE TABLE withdrawals (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'rejected') DEFAULT 'pending',
    admin_notes TEXT,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_status (user_id, status),
    CONSTRAINT fk_withdrawal_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- 9. Fraud Flags Table
-- Tracks suspicious activities for manual or automated review.
CREATE TABLE fraud_flags (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED DEFAULT NULL,
    reason_code VARCHAR(50) NOT NULL, -- e.g., 'IP_COLLISION', 'SHORT_DURATION', 'VPN_DETECTED'
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_severity (user_id, severity),
    CONSTRAINT fk_fraud_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_fraud_session FOREIGN KEY (session_id) REFERENCES traffic_sessions(id)
) ENGINE=InnoDB;

-- Indexing Recommendations Summary:
-- 1. Composite index on (viewer_id, viewed_at) in traffic_sessions for fast user history lookups.
-- 2. Composite index on (unlock_at, status) in earnings_ledger for the background worker that unlocks funds.
-- 3. Unique index on adsterra_revenue_logs(date) to prevent duplicate daily imports.
-- 4. VARBINARY(16) for IP addresses to efficiently store and index IPv6.
-- 5. Foreign keys are used throughout to maintain referential integrity.
