-- +migrate Up
-- joyu.fyi 的追蹤：DB 不存帳號，只用 Firebase uid（joyu-firebase 專案，含匿名帳號）當 key。
-- kind：actress／maker／label／series／director／tag／search；value：女優存 domain:aid，search 存正規化後的查詢字串，其他存名稱。
-- value 最長 512，utf8mb4 放不進 MySQL 5.7 的索引長度上限，唯一索引改用 value 的 SHA-1（value_hash）
CREATE TABLE IF NOT EXISTS `joyu_follows` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `firebase_uid` VARCHAR(128) NOT NULL COMMENT 'joyu-firebase 的 uid',
    `kind` VARCHAR(16) NOT NULL COMMENT 'actress／maker／label／series／director／tag／search',
    `value` VARCHAR(512) NOT NULL COMMENT '女優 domain:aid、搜尋條件查詢字串、其他為名稱',
    `value_hash` CHAR(40) NOT NULL COMMENT 'value 的 SHA-1，唯一索引用',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_joyu_follows_uid_kind_value` (`firebase_uid`, `kind`, `value_hash`),
    KEY `idx_joyu_follows_uid_created` (`firebase_uid`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `joyu_follows`;
