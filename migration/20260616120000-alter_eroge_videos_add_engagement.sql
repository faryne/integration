-- +migrate Up
ALTER TABLE `eroge_videos`
    ADD COLUMN `duration_seconds` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `published_at`,
    ADD COLUMN `likes` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `duration_seconds`,
    ADD COLUMN `dislikes` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `likes`;

CREATE TABLE `galgame_video_reaction_events` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `video_id` BIGINT UNSIGNED NOT NULL,
    `action` ENUM('like', 'dislike', 'cancel_like', 'cancel_dislike') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY `idx_galgame_video_reaction_events_user_video_created` (`user_id`, `video_id`, `created_at`),
    KEY `idx_galgame_video_reaction_events_video_id` (`video_id`),
    CONSTRAINT `fk_galgame_video_reaction_events_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_galgame_video_reaction_events_video`
        FOREIGN KEY (`video_id`) REFERENCES `eroge_videos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `galgame_video_reaction_events`;
ALTER TABLE `eroge_videos`
    DROP COLUMN `dislikes`,
    DROP COLUMN `likes`,
    DROP COLUMN `duration_seconds`;
