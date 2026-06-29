-- +migrate Up
CREATE TABLE `storyteller_agent_providers` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `provider` VARCHAR(64) NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `allow_custom_model` TINYINT(1) NOT NULL DEFAULT 0,
    `sort` INT NOT NULL DEFAULT 0,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_agent_providers_provider` (`provider`),
    KEY `idx_storyteller_agent_providers_sort` (`is_deleted`, `sort`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_agent_models` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `provider_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `sort` INT NOT NULL DEFAULT 0,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_agent_models_provider_name` (`provider_id`, `name`),
    KEY `idx_storyteller_agent_models_provider_sort` (`provider_id`, `is_deleted`, `sort`, `id`),
    CONSTRAINT `fk_storyteller_agent_models_provider`
        FOREIGN KEY (`provider_id`) REFERENCES `storyteller_agent_providers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `storyteller_agent_providers` (`provider`, `label`, `allow_custom_model`, `sort`) VALUES
('grok', 'Grok', 0, 10),
('openai', 'OpenAI', 0, 20),
('claude', 'Claude', 0, 30),
('openrouter', 'OpenRouter', 1, 40);

INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'grok-4', 'Grok 4', 10 FROM `storyteller_agent_providers` WHERE `provider` = 'grok';
INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'grok-3', 'Grok 3', 20 FROM `storyteller_agent_providers` WHERE `provider` = 'grok';
INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'grok-3-mini', 'Grok 3 Mini', 30 FROM `storyteller_agent_providers` WHERE `provider` = 'grok';

INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'gpt-4.1', 'GPT-4.1', 10 FROM `storyteller_agent_providers` WHERE `provider` = 'openai';
INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'gpt-4.1-mini', 'GPT-4.1 Mini', 20 FROM `storyteller_agent_providers` WHERE `provider` = 'openai';
INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'gpt-4o', 'GPT-4o', 30 FROM `storyteller_agent_providers` WHERE `provider` = 'openai';
INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'gpt-4o-mini', 'GPT-4o Mini', 40 FROM `storyteller_agent_providers` WHERE `provider` = 'openai';

INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'claude-3-5-sonnet-latest', 'Claude 3.5 Sonnet', 10 FROM `storyteller_agent_providers` WHERE `provider` = 'claude';
INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'claude-3-5-haiku-latest', 'Claude 3.5 Haiku', 20 FROM `storyteller_agent_providers` WHERE `provider` = 'claude';
INSERT INTO `storyteller_agent_models` (`provider_id`, `name`, `label`, `sort`)
SELECT `id`, 'claude-3-opus-latest', 'Claude 3 Opus', 30 FROM `storyteller_agent_providers` WHERE `provider` = 'claude';

-- +migrate Down
DROP TABLE `storyteller_agent_models`;
DROP TABLE `storyteller_agent_providers`;
