-- +migrate Up
CREATE TABLE `etf_tickers` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `code` varchar(10) NOT NULL COMMENT '股號',
    `ticker_date` date NOT NULL COMMENT '日期',
    `open` decimal(10, 4) NOT NULL default 0 COMMENT '開盤價',
    `close` decimal(10, 4) NOT NULL default 0 COMMENT '收盤價',
    `max` decimal(10, 4) NOT NULL default 0 COMMENT '最高價',
    `min` decimal(10, 4) NOT NULL COMMENT '最低價',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_code_ticker_date` (`code`, `ticker_date`)
) ENGINE=InnoDB;

-- +migrate Down
DROP TABLE `etf_tickers`;