-- +migrate Up
INSERT INTO `storyteller_agent_providers` (`provider`, `label`, `allow_custom_model`, `sort`, `is_deleted`, `deleted_at`)
VALUES ('gemini', 'Gemini', 0, 35, 0, NULL)
ON DUPLICATE KEY UPDATE
    `label` = VALUES(`label`),
    `allow_custom_model` = VALUES(`allow_custom_model`),
    `sort` = VALUES(`sort`),
    `is_deleted` = VALUES(`is_deleted`),
    `deleted_at` = VALUES(`deleted_at`);

INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`, `is_deleted`, `deleted_at`)
SELECT `id`, 'gemini-2.5-pro', 'Gemini 2.5 Pro', 10, 0, NULL
FROM `storyteller_agent_providers`
WHERE `provider` = 'gemini'
ON DUPLICATE KEY UPDATE
    `label` = VALUES(`label`),
    `sort` = VALUES(`sort`),
    `is_deleted` = VALUES(`is_deleted`),
    `deleted_at` = VALUES(`deleted_at`);

INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`, `is_deleted`, `deleted_at`)
SELECT `id`, 'gemini-2.5-flash', 'Gemini 2.5 Flash', 20, 0, NULL
FROM `storyteller_agent_providers`
WHERE `provider` = 'gemini'
ON DUPLICATE KEY UPDATE
    `label` = VALUES(`label`),
    `sort` = VALUES(`sort`),
    `is_deleted` = VALUES(`is_deleted`),
    `deleted_at` = VALUES(`deleted_at`);

INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`, `is_deleted`, `deleted_at`)
SELECT `id`, 'gemini-2.0-flash', 'Gemini 2.0 Flash', 30, 0, NULL
FROM `storyteller_agent_providers`
WHERE `provider` = 'gemini'
ON DUPLICATE KEY UPDATE
    `label` = VALUES(`label`),
    `sort` = VALUES(`sort`),
    `is_deleted` = VALUES(`is_deleted`),
    `deleted_at` = VALUES(`deleted_at`);

-- +migrate Down
UPDATE `storyteller_agent_models` AS `models`
INNER JOIN `storyteller_agent_providers` AS `providers`
    ON `providers`.`id` = `models`.`provider_id`
SET `models`.`is_deleted` = 1,
    `models`.`deleted_at` = CURRENT_TIMESTAMP
WHERE `providers`.`provider` = 'gemini';

UPDATE `storyteller_agent_providers`
SET `is_deleted` = 1,
    `deleted_at` = CURRENT_TIMESTAMP
WHERE `provider` = 'gemini';
