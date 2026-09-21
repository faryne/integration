-- +migrate Up
CREATE TABLE `storyteller_author_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'storyteller_users.id, owner only, never public',
    `pen_name` VARCHAR(255) NOT NULL,
    `bio` TEXT NOT NULL,
    `use_default_avatar` TINYINT(1) NOT NULL DEFAULT 1,
    `avatar_url` VARCHAR(512) NOT NULL DEFAULT '',
    `sns_links` JSON NULL DEFAULT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_storyteller_author_profiles_pen_name` (`pen_name`),
    KEY `idx_storyteller_author_profiles_user` (`user_id`, `deleted_at`),
    KEY `idx_storyteller_author_profiles_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- profile_id=0 代表帳號本人身份，不存在於 profile 表，故不加 FK。
CREATE TABLE `storyteller_story_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `story_id` BIGINT UNSIGNED NOT NULL,
    `profile_id` BIGINT UNSIGNED NOT NULL COMMENT '0 = account identity (self), not an FK',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_storyteller_story_profiles_story_profile` (`story_id`, `profile_id`),
    KEY `idx_storyteller_story_profiles_profile` (`profile_id`),
    CONSTRAINT `fk_storyteller_story_profiles_story`
        FOREIGN KEY (`story_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `storyteller_author_favorites`
    ADD COLUMN `author_profile_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 = account identity (self)' AFTER `author_user_id`,
    DROP INDEX `idx_storyteller_author_favorites_user_author`,
    ADD UNIQUE KEY `idx_storyteller_author_favorites_user_author_profile` (`user_id`, `author_user_id`, `author_profile_id`);

-- +migrate Down
ALTER TABLE `storyteller_author_favorites`
    DROP INDEX `idx_storyteller_author_favorites_user_author_profile`,
    DROP COLUMN `author_profile_id`,
    ADD UNIQUE KEY `idx_storyteller_author_favorites_user_author` (`user_id`, `author_user_id`);

DROP TABLE IF EXISTS `storyteller_story_profiles`;
DROP TABLE IF EXISTS `storyteller_author_profiles`;
