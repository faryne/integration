-- +migrate Up
-- 每月封存匯出的紀錄。MySQL 只刪除「已確認匯出」的月份，S3 到期刪除後也保留這筆紀錄，
-- 作為「哪個月的資料在什麼時候依保存政策刪除」的證明；這張表很小，永久保留。
CREATE TABLE `storyteller_audit_exports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `month` CHAR(7) NOT NULL COMMENT 'YYYY-MM (UTC)',
    `status` VARCHAR(16) NOT NULL COMMENT 'exported, failed',
    `row_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `object_keys` JSON NULL COMMENT 'S3 object keys of this month',
    `checksum` CHAR(64) NULL COMMENT 'sha256 chain over the part checksums, in key order',
    `retain_until` DATETIME NULL DEFAULT NULL COMMENT 'Object Lock retain-until of the parts (UTC); DATETIME because month end + N years can pass 2038',
    `error_message` VARCHAR(255) NULL,
    `exported_at` TIMESTAMP NULL DEFAULT NULL,
    `mysql_purged_at` TIMESTAMP NULL DEFAULT NULL,
    `archive_purged_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_storyteller_audit_exports_month` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 封存查詢 job。前端只拿得到 public_id，Athena execution ID 只存在後端，
-- 並且只有建立 job 的使用者能輪詢與讀取結果。
CREATE TABLE `storyteller_audit_archive_queries` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_id` VARCHAR(32) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `scope` VARCHAR(16) NOT NULL COMMENT 'account',
    `project_id` BIGINT UNSIGNED NULL,
    `month_from` CHAR(7) NOT NULL,
    `month_to` CHAR(7) NOT NULL,
    `filters` JSON NULL,
    `execution_id` VARCHAR(128) NULL,
    `status` VARCHAR(16) NOT NULL COMMENT 'queued, running, succeeded, failed, expired',
    `error_category` VARCHAR(32) NULL,
    `scanned_bytes` BIGINT UNSIGNED NULL,
    `completed_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_storyteller_audit_archive_queries_public_id` (`public_id`),
    KEY `idx_storyteller_audit_archive_queries_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_audit_archive_queries`;
DROP TABLE `storyteller_audit_exports`;
