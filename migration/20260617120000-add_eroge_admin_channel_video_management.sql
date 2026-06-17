-- +migrate Up
ALTER TABLE `eroge_brands`
    ADD COLUMN `index_paused_at` TIMESTAMP NULL DEFAULT NULL AFTER `last_video_synced_at`,
    ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `index_paused_at`,
    ADD KEY `idx_eroge_brands_deleted_at` (`deleted_at`),
    ADD KEY `idx_eroge_brands_index_paused_at` (`index_paused_at`);

ALTER TABLE `eroge_videos`
    ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `youtube_info`,
    ADD KEY `idx_eroge_videos_deleted_at` (`deleted_at`);

CREATE TABLE `eroge_video_submissions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `brand_id` BIGINT UNSIGNED NULL,
    `youtube_channel_id` VARCHAR(64) NOT NULL,
    `youtube_video_id` VARCHAR(32) NOT NULL,
    `video_url` TEXT NOT NULL,
    `title` VARCHAR(500) NOT NULL DEFAULT '',
    `thumbnail_url` TEXT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `reviewed_by_user_id` BIGINT UNSIGNED NULL,
    `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_eroge_video_submissions_video_id` (`youtube_video_id`),
    KEY `idx_eroge_video_submissions_status` (`status`),
    KEY `idx_eroge_video_submissions_brand_id` (`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `eroge_video_submissions`;

ALTER TABLE `eroge_videos`
    DROP KEY `idx_eroge_videos_deleted_at`,
    DROP COLUMN `deleted_at`;

ALTER TABLE `eroge_brands`
    DROP KEY `idx_eroge_brands_index_paused_at`,
    DROP KEY `idx_eroge_brands_deleted_at`,
    DROP COLUMN `deleted_at`,
    DROP COLUMN `index_paused_at`;
