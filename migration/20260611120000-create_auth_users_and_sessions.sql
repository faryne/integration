-- +migrate Up
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `firebase_uid` VARCHAR(128) NOT NULL COMMENT 'Firebase Auth UID',
    `email` VARCHAR(255) NULL COMMENT 'Firebase profile email',
    `display_name` VARCHAR(255) NULL COMMENT 'Firebase profile display name',
    `photo_url` TEXT NULL COMMENT 'Firebase profile photo URL',
    `disabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Local account disabled flag',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `last_login_at` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `idx_users_firebase_uid` (`firebase_uid`),
    KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `users`;
