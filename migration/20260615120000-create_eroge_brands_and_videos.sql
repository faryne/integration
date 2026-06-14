-- +migrate Up
CREATE TABLE `eroge_brands` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `youtube_channel_id` VARCHAR(64) NOT NULL,
    `avatar_url` TEXT NULL,
    `youtube_info` JSON NULL,
    `uploads_playlist_id` VARCHAR(64) NULL,
    `last_channel_synced_at` TIMESTAMP NULL DEFAULT NULL,
    `last_video_synced_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_eroge_brands_youtube_channel_id` (`youtube_channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `eroge_videos` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `brand_id` BIGINT UNSIGNED NOT NULL,
    `youtube_video_id` VARCHAR(32) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `tags` JSON NULL,
    `thumbnail_url` TEXT NULL,
    `description` MEDIUMTEXT NULL,
    `published_at` DATETIME NOT NULL,
    `youtube_info` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_eroge_videos_youtube_video_id` (`youtube_video_id`),
    KEY `idx_eroge_videos_brand_published` (`brand_id`, `published_at`),
    CONSTRAINT `fk_eroge_videos_brand`
        FOREIGN KEY (`brand_id`) REFERENCES `eroge_brands` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `eroge_videos`;
DROP TABLE `eroge_brands`;
