-- +migrate Up
-- 檢舉／內部處置共用的理由表：只存 slug，顯示文字由前端以 moderation.reason.<slug> 對照（日後 i18n）。
-- slug 一經使用不可改名、不可重用（已寫進 delete_reason／reports 的是歷史資料），停用請 soft delete。
CREATE TABLE `storyteller_moderation_reasons` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `reason_key` VARCHAR(64) NOT NULL COMMENT 'Slug ^[a-z][a-z0-9_]{0,63}$; never renamed or reused',
    `applies_to` JSON NULL COMMENT 'Target types this reason applies to; NULL = all',
    `is_reportable` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = selectable by readers; 0 = internal moderation only',
    `sort_order` INT NOT NULL DEFAULT 0,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_moderation_reasons_key` (`reason_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `storyteller_moderation_reasons` (`reason_key`, `applies_to`, `is_reportable`, `sort_order`) VALUES
    ('spam', NULL, 1, 10),
    ('harassment', NULL, 1, 20),
    ('hate_speech', NULL, 1, 30),
    ('unmarked_adult_content', '["project","story","lore"]', 1, 40),
    ('copyright', NULL, 1, 50),
    ('impersonation', '["user","author_profile"]', 1, 60),
    ('personal_info', NULL, 1, 70),
    ('illegal_content', NULL, 1, 80),
    ('other', NULL, 1, 900),
    ('tos_violation', NULL, 0, 1000);

-- 讀者送出的檢舉；後台處理欄位（status／handled_*）先建好，後台之後再做
CREATE TABLE `storyteller_reports` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL,
    `reporter_user_id` BIGINT UNSIGNED NOT NULL,
    `target_type` VARCHAR(32) NOT NULL COMMENT 'project / story / lore / user / author_profile / author_post / discussion_thread / comment',
    `target_id` BIGINT UNSIGNED NOT NULL,
    `reason_key` VARCHAR(64) NOT NULL COMMENT 'storyteller_moderation_reasons.reason_key',
    `note` TEXT NULL COMMENT 'Reporter note, max 1000 chars; required when reason_key = other',
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending / resolved / dismissed',
    `handled_by_user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `handled_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_reports_public_id` (`public_id`),
    KEY `idx_storyteller_reports_target` (`target_type`, `target_id`, `status`),
    KEY `idx_storyteller_reports_status` (`status`, `created_at`),
    KEY `idx_storyteller_reports_reporter` (`reporter_user_id`, `target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 只有 deleted_at 的三張表補上 is_deleted，並讓既有 soft delete 資料符合成對標記的規則
ALTER TABLE `storyteller_users`
    ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `deleted_at`,
    ADD COLUMN `delete_reason` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Internal moderation reason key; NULL = deleted by the user' AFTER `is_deleted`;
ALTER TABLE `storyteller_author_profiles`
    ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `deleted_at`,
    ADD COLUMN `delete_reason` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Internal moderation reason key; NULL = deleted by the user' AFTER `is_deleted`;
ALTER TABLE `storyteller_projects`
    ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `deleted_at`,
    ADD COLUMN `delete_reason` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Internal moderation reason key; NULL = deleted by the user' AFTER `is_deleted`;
UPDATE `storyteller_users` SET `is_deleted` = 1 WHERE `deleted_at` IS NOT NULL;
UPDATE `storyteller_author_profiles` SET `is_deleted` = 1 WHERE `deleted_at` IS NOT NULL;
UPDATE `storyteller_projects` SET `is_deleted` = 1 WHERE `deleted_at` IS NOT NULL;

-- 已有 is_deleted 的五張表只加 delete_reason
ALTER TABLE `storyteller_stories`
    ADD COLUMN `delete_reason` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Internal moderation reason key; NULL = deleted by the user' AFTER `deleted_at`;
ALTER TABLE `storyteller_lores`
    ADD COLUMN `delete_reason` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Internal moderation reason key; NULL = deleted by the user' AFTER `deleted_at`;
ALTER TABLE `storyteller_author_posts`
    ADD COLUMN `delete_reason` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Internal moderation reason key; NULL = deleted by the user' AFTER `deleted_at`;
ALTER TABLE `storyteller_discussion_threads`
    ADD COLUMN `delete_reason` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Internal moderation reason key; NULL = deleted by the user' AFTER `deleted_at`;
ALTER TABLE `storyteller_comments`
    ADD COLUMN `delete_reason` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Internal moderation reason key; NULL = deleted by the user' AFTER `deleted_at`;

-- +migrate Down
ALTER TABLE `storyteller_comments` DROP COLUMN `delete_reason`;
ALTER TABLE `storyteller_discussion_threads` DROP COLUMN `delete_reason`;
ALTER TABLE `storyteller_author_posts` DROP COLUMN `delete_reason`;
ALTER TABLE `storyteller_lores` DROP COLUMN `delete_reason`;
ALTER TABLE `storyteller_stories` DROP COLUMN `delete_reason`;
ALTER TABLE `storyteller_projects` DROP COLUMN `delete_reason`, DROP COLUMN `is_deleted`;
ALTER TABLE `storyteller_author_profiles` DROP COLUMN `delete_reason`, DROP COLUMN `is_deleted`;
ALTER TABLE `storyteller_users` DROP COLUMN `delete_reason`, DROP COLUMN `is_deleted`;
DROP TABLE `storyteller_reports`;
DROP TABLE `storyteller_moderation_reasons`;
