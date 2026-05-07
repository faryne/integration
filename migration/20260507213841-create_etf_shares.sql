-- +migrate Up
CREATE TABLE `etf_shares` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `code` varchar(10) NOT NULL COMMENT '股號',
    `ex_date` date NOT NULL COMMENT '除權日',
    `payable_date` date NOT NULL COMMENT '入帳日',
    `share` decimal(10, 4) NOT NULL default 0 COMMENT '分配金額',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_code_ex_date` (`code`, `ex_date`)
) ENGINE=InnoDB;

-- +migrate Down
DROP TABLE `etf_shares`;