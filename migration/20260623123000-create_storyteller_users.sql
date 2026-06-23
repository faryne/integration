-- +migrate Up
CREATE TABLE `storyteller_users` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `pen_name` VARCHAR(255) NOT NULL DEFAULT '',
    `bio` TEXT NOT NULL,
    `use_default_avatar` TINYINT(1) NOT NULL DEFAULT 1,
    `avatar_url` VARCHAR(512) NOT NULL DEFAULT '',
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_users_user` (`user_id`),
    KEY `idx_storyteller_users_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_users_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_users`;
