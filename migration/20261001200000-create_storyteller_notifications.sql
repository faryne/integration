-- +migrate Up
-- 新話首次對讀者公開的時間：通知排程以它去重，只寫一次，之後草稿↔完成來回切也不會重發
ALTER TABLE `storyteller_stories`
    ADD COLUMN `first_published_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'First time this story became visible to readers; set once by the notification scan',
    ADD KEY `idx_storyteller_stories_first_published` (`first_published_at`);

-- 回填：上線當下已經公開的話一律視為「已通知過」，避免第一輪掃描對全站讀者狂發通知
UPDATE `storyteller_stories` AS `stories`
    INNER JOIN `storyteller_projects` AS `projects` ON `projects`.`id` = `stories`.`project_id`
    LEFT JOIN `storyteller_stories` AS `parent` ON `parent`.`id` = `stories`.`parent_id`
SET `stories`.`first_published_at` = `stories`.`created_at`
WHERE `stories`.`is_volume` = 0 AND `stories`.`is_deleted` = 0 AND `stories`.`deleted_at` IS NULL
  AND `stories`.`status` = 'completed'
  AND `projects`.`visibility` = 'public' AND `projects`.`deleted_at` IS NULL
  AND (`stories`.`parent_id` IS NULL OR `parent`.`status` = 'completed');

CREATE TABLE `storyteller_notifications` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Recipient, storyteller_users.id, no FK per user-decoupling convention',
    `kind` VARCHAR(64) NOT NULL COMMENT 'story.published / project.published / security.oauth.authorized / security.pat.created',
    `group_key` VARCHAR(191) NOT NULL COMMENT 'Idempotency key: one row per (user_id, group_key)',
    `project_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `payload` JSON NOT NULL COMMENT 'Display snapshot taken when the notification was created',
    `read_at` TIMESTAMP NULL DEFAULT NULL,
    `locked_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Locked notifications are exempt from the retention purge',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_notifications_public_id` (`public_id`),
    UNIQUE KEY `uq_storyteller_notifications_user_group` (`user_id`, `group_key`),
    KEY `idx_storyteller_notifications_user_list` (`user_id`, `is_deleted`, `id`),
    KEY `idx_storyteller_notifications_user_unread` (`user_id`, `read_at`),
    KEY `idx_storyteller_notifications_user_locked` (`user_id`, `locked_at`),
    KEY `idx_storyteller_notifications_purge` (`locked_at`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_notifications`;
ALTER TABLE `storyteller_stories`
    DROP KEY `idx_storyteller_stories_first_published`,
    DROP COLUMN `first_published_at`;
