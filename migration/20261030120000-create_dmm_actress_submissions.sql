-- +migrate Up
-- 女優上稿審核：使用者（網頁／MCP）提交新增或修改，管理者核准後才寫進 dmm_actresses 與搜尋
CREATE TABLE IF NOT EXISTS `dmm_actress_submissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `kind` VARCHAR(16) NOT NULL COMMENT 'create / edit',
    `target_domain` VARCHAR(32) NOT NULL DEFAULT '' COMMENT '修改單指向的女優 domain',
    `target_aid` INT NOT NULL DEFAULT 0 COMMENT '修改單指向的女優 id',
    `payload` LONGTEXT NOT NULL COMMENT '提交的完整欄位（JSON）',
    `base_snapshot` LONGTEXT NULL COMMENT '提交當下目標女優的資料（JSON），算 diff 與偵測提交後被改過',
    `changed_fields` VARCHAR(512) NOT NULL DEFAULT '' COMMENT '提交當下有變更的欄位，逗號分隔',
    `channel` VARCHAR(16) NOT NULL DEFAULT 'web' COMMENT 'web / mcp',
    `submitter_user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `submitter_ip_hash` CHAR(64) NOT NULL DEFAULT '' COMMENT '提交者 IP 的 sha256，不存明碼',
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending / approved / rejected',
    `resolution` VARCHAR(16) NOT NULL DEFAULT '' COMMENT 'created / updated / merged',
    `merged_domain` VARCHAR(32) NOT NULL DEFAULT '' COMMENT '核准時實際寫入的女優 domain',
    `merged_aid` INT NOT NULL DEFAULT 0 COMMENT '核准時實際寫入的女優 id',
    `reviewer_user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `review_note` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '否決原因；改為核准時保留',
    `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `dmm_actress_submissions_status_id` (`status`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `dmm_actress_submissions`;
