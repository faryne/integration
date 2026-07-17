-- +migrate Up
CREATE TABLE `etf_favorites` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_etf_favorites_user_code` (`user_id`, `code`),
    KEY `idx_etf_favorites_user_updated` (`user_id`, `updated_at`),
    KEY `idx_etf_favorites_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_etf_favorites_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `etf_saved_transactions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `records` JSON NOT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_etf_saved_transactions_user_code` (`user_id`, `code`),
    KEY `idx_etf_saved_transactions_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_etf_saved_transactions_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `etf_saved_transactions`;
DROP TABLE `etf_favorites`;
