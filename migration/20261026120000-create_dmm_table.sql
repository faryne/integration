-- +migrate Up
-- DMM 影片資料表，原本由 Laravel 建立（正式環境早已存在，IF NOT EXISTS 不會動到）；
-- 補這支是為了讓本機也有這張表，好測 Go 版的每日同步。
CREATE TABLE IF NOT EXISTS `dmm` (
    `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `no` VARCHAR(20) NOT NULL DEFAULT '_' COMMENT '品番（大寫）',
    `title` VARCHAR(255) NOT NULL DEFAULT '_' COMMENT '作品標題',
    `link` VARCHAR(100) NOT NULL DEFAULT '_' COMMENT '作品網址',
    `thumb` VARCHAR(100) NOT NULL DEFAULT '_' COMMENT '縮圖網址',
    `info` JSON NOT NULL COMMENT '作品明細，原樣同步到 ES dmmvideos',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `dmm_no_unique` (`no`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- +migrate Down
-- 正式環境的表不是這支建的，刻意不 DROP，避免 rollback 時把既有影片資料整張砍掉
