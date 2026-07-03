-- +migrate Up
CREATE TABLE `storyteller_provider_apikeys` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `provider` VARCHAR(64) NOT NULL,
    `label` VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'User-defined label to tell keys of the same provider apart',
    `api_key` TEXT NULL,
    `api_key_encrypted` TEXT NULL,
    `api_key_data_key` TEXT NULL,
    `api_key_key_id` VARCHAR(64) NULL,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_storyteller_provider_apikeys_user_provider` (`user_id`, `provider`),
    KEY `idx_storyteller_provider_apikeys_deleted` (`is_deleted`, `deleted_at`),
    CONSTRAINT `fk_storyteller_provider_apikeys_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `storyteller_agents`
    ADD COLUMN `provider_apikey_id` BIGINT UNSIGNED NULL AFTER `agent_model_id`,
    ADD KEY `idx_storyteller_agents_provider_apikey` (`provider_apikey_id`),
    ADD CONSTRAINT `fk_storyteller_agents_provider_apikey`
        FOREIGN KEY (`provider_apikey_id`) REFERENCES `storyteller_provider_apikeys` (`id`) ON DELETE SET NULL;

-- Temporary column to map each backfilled provider_apikey row back to the agent it came from.
ALTER TABLE `storyteller_provider_apikeys`
    ADD COLUMN `migrated_from_agent_id` BIGINT UNSIGNED NULL;

INSERT INTO `storyteller_provider_apikeys`
    (`user_id`, `provider`, `label`, `api_key`, `api_key_encrypted`, `api_key_data_key`, `api_key_key_id`, `migrated_from_agent_id`, `created_at`, `updated_at`)
SELECT
    `agents`.`user_id`,
    `agents`.`provider`,
    `agents`.`name`,
    `agents`.`api_key`,
    `agents`.`api_key_encrypted`,
    `agents`.`api_key_data_key`,
    `agents`.`api_key_key_id`,
    `agents`.`id`,
    `agents`.`created_at`,
    `agents`.`updated_at`
FROM `storyteller_agents` AS `agents`
WHERE `agents`.`is_deleted` = 0
    AND `agents`.`deleted_at` IS NULL
    AND (
        (`agents`.`api_key_encrypted` IS NOT NULL AND `agents`.`api_key_encrypted` <> '')
        OR (`agents`.`api_key` IS NOT NULL AND `agents`.`api_key` <> '')
    );

UPDATE `storyteller_agents` AS `agents`
INNER JOIN `storyteller_provider_apikeys` AS `keys`
    ON `keys`.`migrated_from_agent_id` = `agents`.`id`
SET `agents`.`provider_apikey_id` = `keys`.`id`
WHERE `agents`.`provider_apikey_id` IS NULL;

ALTER TABLE `storyteller_provider_apikeys`
    DROP COLUMN `migrated_from_agent_id`;

-- +migrate Down
ALTER TABLE `storyteller_agents`
    DROP FOREIGN KEY `fk_storyteller_agents_provider_apikey`,
    DROP KEY `idx_storyteller_agents_provider_apikey`,
    DROP COLUMN `provider_apikey_id`;
DROP TABLE `storyteller_provider_apikeys`;
