-- +migrate Up
ALTER TABLE `storyteller_users`
    ADD COLUMN `auto_save_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `hide_favorite_authors`,
    ADD COLUMN `auto_save_interval_minutes` INT NOT NULL DEFAULT 5 AFTER `auto_save_enabled`;

-- +migrate Down
ALTER TABLE `storyteller_users`
    DROP COLUMN `auto_save_interval_minutes`,
    DROP COLUMN `auto_save_enabled`;
