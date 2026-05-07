-- +migrate Up
CREATE TABLE `etf_codes` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `code` varchar(10) NOT NULL COMMENT '股號',
    `name` varchar(100) NOT NULL COMMENT 'ETF 名稱',
    `company` varchar(100) NOT NULL default '' COMMENT '發行公司',
    `target` varchar(255) NOT NULL default '' COMMENT '追蹤指數',
    `market` enum('twse', 'otc') NOT NULL COMMENT '上市市長，證交所 / 櫃買中心',
    `publish_date` varchar(64) NOT NULL COMMENT '上市/發行日期',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_code` (`code`)
) ENGINE=InnoDB;

-- +migrate Down
DROP TABLE `etf_codes`;
