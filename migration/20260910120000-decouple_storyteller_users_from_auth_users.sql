-- +migrate Up
ALTER TABLE `storyteller_users`
    DROP FOREIGN KEY `fk_storyteller_users_user`;

ALTER TABLE `storyteller_projects`
    DROP FOREIGN KEY `fk_storyteller_projects_user`;

ALTER TABLE `storyteller_agents`
    DROP FOREIGN KEY `fk_storyteller_agents_user`;

ALTER TABLE `storyteller_story_chats`
    DROP FOREIGN KEY `fk_storyteller_story_chats_user`;

ALTER TABLE `storyteller_project_rankings`
    DROP FOREIGN KEY `fk_storyteller_project_rankings_user`;

ALTER TABLE `storyteller_author_favorites`
    DROP FOREIGN KEY `fk_storyteller_author_favorites_user`,
    DROP FOREIGN KEY `fk_storyteller_author_favorites_author`;

ALTER TABLE `storyteller_provider_apikeys`
    DROP FOREIGN KEY `fk_storyteller_provider_apikeys_user`;

ALTER TABLE `storyteller_agent_usage_logs`
    DROP FOREIGN KEY `fk_storyteller_agent_usage_logs_user`;

ALTER TABLE `storyteller_story_bookmarks`
    DROP FOREIGN KEY `fk_storyteller_story_bookmarks_user`;

ALTER TABLE `storyteller_personal_access_tokens`
    DROP FOREIGN KEY `fk_storyteller_pat_user`;

ALTER TABLE `storyteller_assets`
    DROP FOREIGN KEY `fk_storyteller_assets_user`;

ALTER TABLE `storyteller_writing_bookmarks`
    DROP FOREIGN KEY `fk_writing_bookmarks_user`;

ALTER TABLE `storyteller_users`
    DROP INDEX `idx_storyteller_users_user`,
    ADD COLUMN `firebase_uid` VARCHAR(128) NULL COMMENT 'Firebase Auth UID for storyteller login' AFTER `user_id`,
    ADD COLUMN `email` VARCHAR(255) NULL COMMENT 'Firebase profile email' AFTER `firebase_uid`,
    ADD COLUMN `display_name` VARCHAR(255) NULL COMMENT 'Firebase profile display name' AFTER `email`,
    ADD COLUMN `photo_url` TEXT NULL COMMENT 'Firebase profile photo URL' AFTER `display_name`,
    ADD UNIQUE KEY `idx_storyteller_users_firebase_uid` (`firebase_uid`),
    ADD KEY `idx_storyteller_users_user` (`user_id`);

UPDATE `storyteller_users` AS `su`
INNER JOIN `users` AS `u` ON `u`.`id` = `su`.`user_id`
SET
    `su`.`firebase_uid` = `u`.`firebase_uid`,
    `su`.`email` = `u`.`email`,
    `su`.`display_name` = `u`.`display_name`,
    `su`.`photo_url` = `u`.`photo_url`;

UPDATE `storyteller_projects` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_agents` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_story_chats` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_project_rankings` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_author_favorites` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_author_favorites` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`author_user_id`
SET `t`.`author_user_id` = `su`.`id`;

UPDATE `storyteller_provider_apikeys` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_agent_usage_logs` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_story_bookmarks` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_personal_access_tokens` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_assets` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

UPDATE `storyteller_writing_bookmarks` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`user_id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`id`;

-- +migrate Down
UPDATE `storyteller_projects` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_agents` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_story_chats` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_project_rankings` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_author_favorites` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_author_favorites` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`author_user_id`
SET `t`.`author_user_id` = `su`.`user_id`;

UPDATE `storyteller_provider_apikeys` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_agent_usage_logs` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_story_bookmarks` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_personal_access_tokens` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_assets` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

UPDATE `storyteller_writing_bookmarks` AS `t`
INNER JOIN `storyteller_users` AS `su` ON `su`.`id` = `t`.`user_id`
SET `t`.`user_id` = `su`.`user_id`;

ALTER TABLE `storyteller_users`
    DROP INDEX `idx_storyteller_users_user`,
    DROP INDEX `idx_storyteller_users_firebase_uid`,
    DROP COLUMN `photo_url`,
    DROP COLUMN `display_name`,
    DROP COLUMN `email`,
    DROP COLUMN `firebase_uid`,
    ADD UNIQUE KEY `idx_storyteller_users_user` (`user_id`);

ALTER TABLE `storyteller_users`
    ADD CONSTRAINT `fk_storyteller_users_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_projects`
    ADD CONSTRAINT `fk_storyteller_projects_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_agents`
    ADD CONSTRAINT `fk_storyteller_agents_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_story_chats`
    ADD CONSTRAINT `fk_storyteller_story_chats_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_project_rankings`
    ADD CONSTRAINT `fk_storyteller_project_rankings_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_author_favorites`
    ADD CONSTRAINT `fk_storyteller_author_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    ADD CONSTRAINT `fk_storyteller_author_favorites_author`
        FOREIGN KEY (`author_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_provider_apikeys`
    ADD CONSTRAINT `fk_storyteller_provider_apikeys_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_agent_usage_logs`
    ADD CONSTRAINT `fk_storyteller_agent_usage_logs_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_story_bookmarks`
    ADD CONSTRAINT `fk_storyteller_story_bookmarks_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_personal_access_tokens`
    ADD CONSTRAINT `fk_storyteller_pat_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_assets`
    ADD CONSTRAINT `fk_storyteller_assets_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `storyteller_writing_bookmarks`
    ADD CONSTRAINT `fk_writing_bookmarks_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
