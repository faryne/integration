-- +migrate Up
CREATE TABLE `storyteller_author_favorites` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `author_user_id` BIGINT UNSIGNED NOT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_storyteller_author_favorites_user_author` (`user_id`, `author_user_id`),
    KEY `idx_storyteller_author_favorites_user_updated` (`user_id`, `updated_at`),
    KEY `idx_storyteller_author_favorites_author` (`author_user_id`),
    KEY `idx_storyteller_author_favorites_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_author_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_author_favorites_author`
        FOREIGN KEY (`author_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_author_favorites`;
