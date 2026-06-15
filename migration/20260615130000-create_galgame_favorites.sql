-- +migrate Up
CREATE TABLE `galgame_brand_favorites` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `brand_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`user_id`, `brand_id`),
    KEY `idx_galgame_brand_favorites_brand_id` (`brand_id`),
    CONSTRAINT `fk_galgame_brand_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_galgame_brand_favorites_brand`
        FOREIGN KEY (`brand_id`) REFERENCES `eroge_brands` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `galgame_video_favorites` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `video_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`user_id`, `video_id`),
    KEY `idx_galgame_video_favorites_video_id` (`video_id`),
    CONSTRAINT `fk_galgame_video_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_galgame_video_favorites_video`
        FOREIGN KEY (`video_id`) REFERENCES `eroge_videos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `galgame_video_favorites`;
DROP TABLE IF EXISTS `galgame_brand_favorites`;
