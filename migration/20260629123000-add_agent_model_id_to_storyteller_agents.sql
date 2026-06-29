-- +migrate Up
ALTER TABLE `storyteller_agents`
    ADD COLUMN `agent_model_id` BIGINT UNSIGNED NULL AFTER `model_name`,
    ADD KEY `idx_storyteller_agents_agent_model` (`agent_model_id`),
    ADD CONSTRAINT `fk_storyteller_agents_agent_model`
        FOREIGN KEY (`agent_model_id`) REFERENCES `storyteller_agent_models` (`id`) ON DELETE SET NULL;

UPDATE `storyteller_agents` AS `agents`
INNER JOIN `storyteller_agent_providers` AS `providers`
    ON `providers`.`provider` = `agents`.`provider`
    AND `providers`.`is_deleted` = 0
    AND `providers`.`deleted_at` IS NULL
INNER JOIN `storyteller_agent_models` AS `models`
    ON `models`.`provider_id` = `providers`.`id`
    AND `models`.`name` = `agents`.`model_name`
    AND `models`.`is_deleted` = 0
    AND `models`.`deleted_at` IS NULL
SET `agents`.`agent_model_id` = `models`.`id`
WHERE `agents`.`agent_model_id` IS NULL;

-- +migrate Down
ALTER TABLE `storyteller_agents`
    DROP FOREIGN KEY `fk_storyteller_agents_agent_model`,
    DROP KEY `idx_storyteller_agents_agent_model`,
    DROP COLUMN `agent_model_id`;
