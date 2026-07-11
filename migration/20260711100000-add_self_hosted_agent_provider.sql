-- +migrate Up
ALTER TABLE `storyteller_provider_apikeys`
    ADD COLUMN `endpoint` VARCHAR(255) NULL COMMENT 'Only used by self-hosted / custom endpoint providers' AFTER `label`;

INSERT INTO `storyteller_agent_providers` (`provider`, `label`, `allow_custom_model`, `sort`)
VALUES ('self_hosted', 'Self-hosted (OpenAI 相容)', 1, 50)
ON DUPLICATE KEY UPDATE
    `label` = VALUES(`label`),
    `allow_custom_model` = VALUES(`allow_custom_model`),
    `sort` = VALUES(`sort`);

-- +migrate Down
UPDATE `storyteller_agent_providers`
SET `is_deleted` = 1,
    `deleted_at` = CURRENT_TIMESTAMP
WHERE `provider` = 'self_hosted';

ALTER TABLE `storyteller_provider_apikeys`
    DROP COLUMN `endpoint`;
