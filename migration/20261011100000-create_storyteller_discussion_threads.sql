-- +migrate Up
-- 專案討論版：討論串屬於專案，可以錨定在某一話（story）或某篇設定（lore）；回覆沿用 storyteller_comments
CREATE TABLE `storyteller_discussion_threads` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL,
    `project_id` BIGINT UNSIGNED NOT NULL,
    `anchor_type` VARCHAR(16) NOT NULL DEFAULT '' COMMENT 'empty = general / story / lore',
    `anchor_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'storyteller_stories.id or storyteller_lores.id',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Starter account; never exposed',
    `profile_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Starter identity; 0 = account identity (self)',
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL COMMENT 'Plain text with [spoiler]/[r18] markers',
    `edit_history` JSON NULL COMMENT 'Previous versions: [{title, body, edited_at}], appended on every edit',
    `edited_at` TIMESTAMP NULL DEFAULT NULL,
    `locked_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Locked threads accept no new replies or edits',
    `last_activity_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Bumped by new replies; sort key for 最新回覆',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_discussion_threads_public_id` (`public_id`),
    KEY `idx_storyteller_discussion_threads_activity` (`project_id`, `is_deleted`, `last_activity_at`),
    KEY `idx_storyteller_discussion_threads_anchor` (`project_id`, `anchor_type`, `anchor_id`, `is_deleted`),
    KEY `idx_storyteller_discussion_threads_identity` (`user_id`, `profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 討論版的留言可以編輯：舊版本存進 edit_history（動態留言不開放編輯，這兩欄會一直是 NULL）
ALTER TABLE `storyteller_comments`
    ADD COLUMN `edit_history` JSON NULL COMMENT 'Previous versions: [{body, edited_at}]' AFTER `body`,
    ADD COLUMN `edited_at` TIMESTAMP NULL DEFAULT NULL AFTER `edit_history`;

-- +migrate Down
ALTER TABLE `storyteller_comments`
    DROP COLUMN `edited_at`,
    DROP COLUMN `edit_history`;
DROP TABLE `storyteller_discussion_threads`;
