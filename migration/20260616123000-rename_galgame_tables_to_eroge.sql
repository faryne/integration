-- +migrate Up
ALTER TABLE `galgame_brand_favorites`
    DROP FOREIGN KEY `fk_galgame_brand_favorites_user`,
    DROP FOREIGN KEY `fk_galgame_brand_favorites_brand`,
    RENAME INDEX `idx_galgame_brand_favorites_brand_id` TO `idx_eroge_brand_favorites_brand_id`;

ALTER TABLE `galgame_video_favorites`
    DROP FOREIGN KEY `fk_galgame_video_favorites_user`,
    DROP FOREIGN KEY `fk_galgame_video_favorites_video`,
    RENAME INDEX `idx_galgame_video_favorites_video_id` TO `idx_eroge_video_favorites_video_id`;

ALTER TABLE `galgame_video_reaction_events`
    DROP FOREIGN KEY `fk_galgame_video_reaction_events_user`,
    DROP FOREIGN KEY `fk_galgame_video_reaction_events_video`,
    RENAME INDEX `idx_galgame_video_reaction_events_user_video_created` TO `idx_eroge_video_reaction_events_user_video_created`,
    RENAME INDEX `idx_galgame_video_reaction_events_video_id` TO `idx_eroge_video_reaction_events_video_id`;

RENAME TABLE
    `galgame_brand_favorites` TO `eroge_brand_favorites`,
    `galgame_video_favorites` TO `eroge_video_favorites`,
    `galgame_video_reaction_events` TO `eroge_video_reaction_events`;

ALTER TABLE `eroge_brand_favorites`
    ADD CONSTRAINT `fk_eroge_brand_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_eroge_brand_favorites_brand`
        FOREIGN KEY (`brand_id`) REFERENCES `eroge_brands` (`id`) ON DELETE CASCADE;

ALTER TABLE `eroge_video_favorites`
    ADD CONSTRAINT `fk_eroge_video_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_eroge_video_favorites_video`
        FOREIGN KEY (`video_id`) REFERENCES `eroge_videos` (`id`) ON DELETE CASCADE;

ALTER TABLE `eroge_video_reaction_events`
    ADD CONSTRAINT `fk_eroge_video_reaction_events_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_eroge_video_reaction_events_video`
        FOREIGN KEY (`video_id`) REFERENCES `eroge_videos` (`id`) ON DELETE CASCADE;

-- +migrate Down
ALTER TABLE `eroge_brand_favorites`
    DROP FOREIGN KEY `fk_eroge_brand_favorites_user`,
    DROP FOREIGN KEY `fk_eroge_brand_favorites_brand`,
    RENAME INDEX `idx_eroge_brand_favorites_brand_id` TO `idx_galgame_brand_favorites_brand_id`;

ALTER TABLE `eroge_video_favorites`
    DROP FOREIGN KEY `fk_eroge_video_favorites_user`,
    DROP FOREIGN KEY `fk_eroge_video_favorites_video`,
    RENAME INDEX `idx_eroge_video_favorites_video_id` TO `idx_galgame_video_favorites_video_id`;

ALTER TABLE `eroge_video_reaction_events`
    DROP FOREIGN KEY `fk_eroge_video_reaction_events_user`,
    DROP FOREIGN KEY `fk_eroge_video_reaction_events_video`,
    RENAME INDEX `idx_eroge_video_reaction_events_user_video_created` TO `idx_galgame_video_reaction_events_user_video_created`,
    RENAME INDEX `idx_eroge_video_reaction_events_video_id` TO `idx_galgame_video_reaction_events_video_id`;

RENAME TABLE
    `eroge_brand_favorites` TO `galgame_brand_favorites`,
    `eroge_video_favorites` TO `galgame_video_favorites`,
    `eroge_video_reaction_events` TO `galgame_video_reaction_events`;

ALTER TABLE `galgame_brand_favorites`
    ADD CONSTRAINT `fk_galgame_brand_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_galgame_brand_favorites_brand`
        FOREIGN KEY (`brand_id`) REFERENCES `eroge_brands` (`id`) ON DELETE CASCADE;

ALTER TABLE `galgame_video_favorites`
    ADD CONSTRAINT `fk_galgame_video_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_galgame_video_favorites_video`
        FOREIGN KEY (`video_id`) REFERENCES `eroge_videos` (`id`) ON DELETE CASCADE;

ALTER TABLE `galgame_video_reaction_events`
    ADD CONSTRAINT `fk_galgame_video_reaction_events_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_galgame_video_reaction_events_video`
        FOREIGN KEY (`video_id`) REFERENCES `eroge_videos` (`id`) ON DELETE CASCADE;
