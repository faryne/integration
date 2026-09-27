-- +migrate Up
ALTER TABLE `storyteller_personal_access_tokens`
    ADD COLUMN `public_id` VARCHAR(64) NULL AFTER `id`;

UPDATE `storyteller_personal_access_tokens`
SET `public_id` = CONCAT('pat_', LOWER(HEX(RANDOM_BYTES(8))))
WHERE `public_id` IS NULL;

ALTER TABLE `storyteller_personal_access_tokens`
    MODIFY COLUMN `public_id` VARCHAR(64) NOT NULL,
    ADD UNIQUE KEY `uq_storyteller_pat_public_id` (`public_id`);

CREATE TABLE `storyteller_audit_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `event_id` CHAR(26) NOT NULL,
    -- 一定要明寫 DEFAULT：MySQL 5.7 在 explicit_defaults_for_timestamp=OFF 時，會替第一個 TIMESTAMP NOT NULL 欄位
    -- 自動加上 ON UPDATE CURRENT_TIMESTAMP，標記 archived_at 的 UPDATE 就會把事件發生時間改成「現在」。
    `occurred_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `actor_type` VARCHAR(16) NOT NULL,
    `actor_user_id` BIGINT UNSIGNED NULL,
    `source` VARCHAR(16) NOT NULL,
    `auth_method` VARCHAR(16) NOT NULL,
    `credential_ref` VARCHAR(64) NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `request_id` VARCHAR(64) NULL,
    `project_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(64) NOT NULL,
    `target_type` VARCHAR(32) NULL,
    `target_public_id` VARCHAR(64) NULL,
    `outcome` VARCHAR(16) NOT NULL,
    `summary` JSON NULL,
    `archived_at` TIMESTAMP(6) NULL DEFAULT NULL COMMENT 'set when the row is in a committed S3 archive part; MySQL purge only deletes archived rows',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_storyteller_audit_events_event_id` (`event_id`),
    KEY `idx_storyteller_audit_events_project_occurred` (`project_id`, `occurred_at`, `id`),
    KEY `idx_storyteller_audit_events_actor_occurred` (`actor_user_id`, `occurred_at`, `id`),
    KEY `idx_storyteller_audit_events_target_occurred` (`target_type`, `target_public_id`, `occurred_at`),
    KEY `idx_storyteller_audit_events_occurred` (`occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_audit_events`;

ALTER TABLE `storyteller_personal_access_tokens`
    DROP INDEX `uq_storyteller_pat_public_id`,
    DROP COLUMN `public_id`;
