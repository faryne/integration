-- +migrate Up
ALTER TABLE `storyteller_users`
    ADD COLUMN `sns_links` JSON NULL DEFAULT NULL AFTER `avatar_url`,
    ADD COLUMN `hide_favorite_projects` TINYINT(1) NOT NULL DEFAULT 0 AFTER `sns_links`,
    ADD COLUMN `hide_favorite_authors` TINYINT(1) NOT NULL DEFAULT 0 AFTER `hide_favorite_projects`;

-- +migrate Down
ALTER TABLE `storyteller_users`
    DROP COLUMN `hide_favorite_authors`,
    DROP COLUMN `hide_favorite_projects`,
    DROP COLUMN `sns_links`;
