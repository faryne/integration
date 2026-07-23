-- +migrate Up
CREATE TABLE `storyteller_personal_access_tokens` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `label` VARCHAR(255) NOT NULL DEFAULT '',
    `token_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 hex digest of the token, plaintext is only shown once at creation',
    `token_prefix` VARCHAR(16) NOT NULL COMMENT 'First few chars of the plaintext token, for the user to tell tokens apart in the list UI',
    `last_used_at` TIMESTAMP NULL DEFAULT NULL,
    `expires_at` TIMESTAMP NULL DEFAULT NULL,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_pat_token_hash` (`token_hash`),
    KEY `idx_storyteller_pat_user` (`user_id`, `is_deleted`),
    CONSTRAINT `fk_storyteller_pat_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_personal_access_tokens`;
