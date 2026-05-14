-- +migrate Up
-- 1. 儲存目標網頁的基本資訊
CREATE TABLE `webshot_main` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `url` TEXT NOT NULL COMMENT '目標網頁網址',
    `url_hash` CHAR(64) NOT NULL COMMENT '網址的 SHA256 雜湊，用於快速索引',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_url_hash` (`url_hash`)
) ENGINE=InnoDB;

-- +migrate Down
DROP TABLE `webshot_main`;