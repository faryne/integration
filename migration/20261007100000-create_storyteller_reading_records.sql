-- +migrate Up
-- 讀者的閱讀進度：每位讀者對每篇故事（之後也包含設定）只有一筆，progress 記「讀過的最遠位置」只增不減
CREATE TABLE `storyteller_reading_records` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Reader, storyteller_users.id, no FK per user-decoupling convention',
    `project_id` BIGINT UNSIGNED NOT NULL,
    `target_type` VARCHAR(16) NOT NULL COMMENT 'story (text or image episode) / lore',
    `target_id` BIGINT UNSIGNED NOT NULL,
    `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Furthest position reached, 0-100, never decreases',
    `completed_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'First time progress reached 100; NULL = not finished yet',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Last time progress moved forward; drives continue-reading',
    UNIQUE KEY `uq_storyteller_reading_records_target` (`user_id`, `target_type`, `target_id`),
    KEY `idx_storyteller_reading_records_project` (`user_id`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_reading_records`;
