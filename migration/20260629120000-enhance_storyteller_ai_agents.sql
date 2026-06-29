-- +migrate Up
CREATE TABLE `storyteller_agent_prompt_versions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `agent_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `provider` VARCHAR(64) NOT NULL,
    `model_name` VARCHAR(255) NOT NULL,
    `default_prompt` MEDIUMTEXT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_storyteller_agent_prompt_versions_agent_created` (`agent_id`, `created_at`),
    KEY `idx_storyteller_agent_prompt_versions_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_agent_prompt_versions_agent`
        FOREIGN KEY (`agent_id`) REFERENCES `storyteller_agents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `storyteller_story_chats`
    DROP KEY `idx_storyteller_story_chats_deleted_at`,
    DROP COLUMN `title`,
    DROP COLUMN `metadata`,
    DROP COLUMN `deleted_at`;

-- +migrate Down
ALTER TABLE `storyteller_story_chats`
    ADD COLUMN `title` VARCHAR(255) NOT NULL DEFAULT '' AFTER `user_id`,
    ADD COLUMN `metadata` JSON NULL AFTER `title`,
    ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `metadata`,
    ADD KEY `idx_storyteller_story_chats_deleted_at` (`deleted_at`);

DROP TABLE `storyteller_agent_prompt_versions`;
