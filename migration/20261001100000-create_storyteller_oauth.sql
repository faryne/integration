-- +migrate Up
CREATE TABLE `storyteller_oauth_clients` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `client_id` VARCHAR(64) NOT NULL COMMENT 'Public client identifier issued by dynamic client registration (RFC 7591)',
    `client_name` VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'Self-declared by the client, never trusted as identity',
    `redirect_uris` TEXT NOT NULL COMMENT 'JSON array of exact-match redirect URIs',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_oauth_clients_client_id` (`client_id`),
    KEY `idx_storyteller_oauth_clients_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_oauth_grants` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'storyteller_users.id, no FK per user-decoupling convention',
    `oauth_client_id` BIGINT UNSIGNED NOT NULL,
    `resource` VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'RFC 8707 resource the tokens are bound to',
    `access_token_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 hex digest of the current access token',
    `access_expires_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `refresh_token_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 hex digest of the current refresh token, rotated on every refresh',
    `refresh_expires_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_used_at` TIMESTAMP NULL DEFAULT NULL,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_oauth_grants_public_id` (`public_id`),
    UNIQUE KEY `uq_storyteller_oauth_grants_access_hash` (`access_token_hash`),
    UNIQUE KEY `uq_storyteller_oauth_grants_refresh_hash` (`refresh_token_hash`),
    KEY `idx_storyteller_oauth_grants_user` (`user_id`, `is_deleted`),
    KEY `idx_storyteller_oauth_grants_client` (`oauth_client_id`),
    CONSTRAINT `fk_storyteller_oauth_grants_client`
        FOREIGN KEY (`oauth_client_id`) REFERENCES `storyteller_oauth_clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_oauth_grants`;
DROP TABLE `storyteller_oauth_clients`;
