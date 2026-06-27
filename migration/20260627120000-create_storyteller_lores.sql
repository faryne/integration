-- +migrate Up
CREATE TABLE `storyteller_lores` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL COMMENT 'Random identifier used in frontend routes',
    `project_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `latest_content` MEDIUMTEXT NULL,
    `word_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_lores_public_id` (`public_id`),
    KEY `idx_storyteller_lores_project_updated` (`project_id`, `updated_at`),
    KEY `idx_storyteller_lores_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_lores_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_lore_versions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `lore_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `content` MEDIUMTEXT NOT NULL,
    `word_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_storyteller_lore_versions_lore_created` (`lore_id`, `created_at`),
    KEY `idx_storyteller_lore_versions_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_lore_versions_lore`
        FOREIGN KEY (`lore_id`) REFERENCES `storyteller_lores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_lore_versions`;
DROP TABLE `storyteller_lores`;
