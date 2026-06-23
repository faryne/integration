-- +migrate Up
CREATE TABLE `storyteller_project_favorites` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `project_id` BIGINT UNSIGNED NOT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_project_favorites_user_project` (`user_id`, `project_id`),
    KEY `idx_storyteller_project_favorites_user_updated` (`user_id`, `updated_at`),
    KEY `idx_storyteller_project_favorites_project` (`project_id`),
    KEY `idx_storyteller_project_favorites_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_project_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_project_favorites_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_project_favorites`;
