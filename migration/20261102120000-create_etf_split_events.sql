-- +migrate Up
CREATE TABLE `etf_split_events` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(10) NOT NULL COMMENT '股號',
    `effective_date` DATE NOT NULL COMMENT '恢復買賣日：當天起股數與價格皆為分割(反分割)後的基準',
    `ratio` DECIMAL(20, 10) NOT NULL COMMENT '分割後單位數 / 分割前單位數，1 拆 4 = 4，7 合 1 = 0.1428571429',
    `source` VARCHAR(16) NOT NULL COMMENT 'preview：證交所預告表（比率精確）；history：由恢復買賣參考價反推',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_etf_split_events_code_date` (`code`, `effective_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `etf_split_events`;
