-- +migrate Up
CREATE TABLE `storyteller_provider_apikey_models` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `provider_apikey_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL COMMENT 'User-defined self-hosted model name',
    `sort` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_provider_apikey_models_key_name` (`provider_apikey_id`, `name`),
    KEY `idx_storyteller_provider_apikey_models_key_sort` (`provider_apikey_id`, `sort`, `created_at`, `id`),
    CONSTRAINT `fk_storyteller_provider_apikey_models_key`
        FOREIGN KEY (`provider_apikey_id`) REFERENCES `storyteller_provider_apikeys` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_provider_apikey_models`;
