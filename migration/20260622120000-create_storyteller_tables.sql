-- +migrate Up
CREATE TABLE `storyteller_projects` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL COMMENT 'Random identifier used in frontend routes',
    `user_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NULL COMMENT 'User-defined special URL segment',
    `description` TEXT NULL,
    `visibility` VARCHAR(32) NOT NULL DEFAULT 'private' COMMENT 'public, unlisted, private',
    `share_token` VARCHAR(64) NULL COMMENT 'Token for unlisted share URL',
    `rating_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `rating_total` DECIMAL(12,1) NOT NULL DEFAULT 0.0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_projects_public_id` (`public_id`),
    UNIQUE KEY `idx_storyteller_projects_user_name` (`user_id`, `name`),
    UNIQUE KEY `idx_storyteller_projects_user_slug` (`user_id`, `slug`),
    KEY `idx_storyteller_projects_user_visibility` (`user_id`, `visibility`),
    KEY `idx_storyteller_projects_visibility_rating` (`visibility`, `rating_count`, `rating_total`),
    KEY `idx_storyteller_projects_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_projects_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_agents` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `provider` VARCHAR(64) NOT NULL DEFAULT 'grok',
    `model_name` VARCHAR(255) NOT NULL,
    `api_key` TEXT NOT NULL,
    `default_prompt` MEDIUMTEXT NULL,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_agents_user_name` (`user_id`, `name`),
    KEY `idx_storyteller_agents_user_provider` (`user_id`, `provider`),
    KEY `idx_storyteller_agents_deleted` (`is_deleted`, `deleted_at`),
    CONSTRAINT `fk_storyteller_agents_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_stories` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL COMMENT 'Random identifier used in frontend routes',
    `project_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `summary` TEXT NULL,
    `sort` INT NOT NULL DEFAULT 0,
    `latest_content` MEDIUMTEXT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_stories_public_id` (`public_id`),
    KEY `idx_storyteller_stories_project_sort` (`project_id`, `sort`),
    KEY `idx_storyteller_stories_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_stories_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_story_versions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `story_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `summary` TEXT NULL,
    `content` MEDIUMTEXT NOT NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_storyteller_story_versions_story_created` (`story_id`, `created_at`),
    KEY `idx_storyteller_story_versions_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_story_versions_story`
        FOREIGN KEY (`story_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_story_chats` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `story_id` BIGINT UNSIGNED NOT NULL,
    `agent_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(255) NOT NULL DEFAULT '',
    `metadata` JSON NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_storyteller_story_chats_story_updated` (`story_id`, `updated_at`),
    KEY `idx_storyteller_story_chats_user_updated` (`user_id`, `updated_at`),
    KEY `idx_storyteller_story_chats_agent` (`agent_id`),
    KEY `idx_storyteller_story_chats_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_story_chats_story`
        FOREIGN KEY (`story_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_story_chats_agent`
        FOREIGN KEY (`agent_id`) REFERENCES `storyteller_agents` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_story_chats_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_story_chat_messages` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `chat_id` BIGINT UNSIGNED NOT NULL,
    `role` VARCHAR(32) NOT NULL COMMENT 'system, user, assistant',
    `content` MEDIUMTEXT NOT NULL,
    `metadata` JSON NULL,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_storyteller_story_chat_messages_chat_created` (`chat_id`, `created_at`),
    KEY `idx_storyteller_story_chat_messages_role` (`role`),
    KEY `idx_storyteller_story_chat_messages_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_story_chat_messages_chat`
        FOREIGN KEY (`chat_id`) REFERENCES `storyteller_story_chats` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_story_chat_messages`;
DROP TABLE `storyteller_story_chats`;
DROP TABLE `storyteller_story_versions`;
DROP TABLE `storyteller_stories`;
DROP TABLE `storyteller_agents`;
DROP TABLE `storyteller_projects`;
