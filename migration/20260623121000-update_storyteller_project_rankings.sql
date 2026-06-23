-- +migrate Up
ALTER TABLE `storyteller_projects`
    DROP COLUMN `rating_count`,
    DROP COLUMN `rating_total`;

ALTER TABLE `storyteller_stories`
    ADD COLUMN `word_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `latest_content`;

ALTER TABLE `storyteller_story_versions`
    ADD COLUMN `word_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `content`;

CREATE TABLE `storyteller_project_rankings` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `project_id` BIGINT UNSIGNED NOT NULL,
    `ranking` DECIMAL(2,1) NULL,
    `is_favorite` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_project_rankings_user_project` (`user_id`, `project_id`),
    KEY `idx_storyteller_project_rankings_project` (`project_id`),
    KEY `idx_storyteller_project_rankings_favorite` (`user_id`, `is_favorite`, `updated_at`),
    KEY `idx_storyteller_project_rankings_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_storyteller_project_rankings_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_project_rankings_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `storyteller_project_rankings` (
    `user_id`,
    `project_id`,
    `ranking`,
    `is_favorite`,
    `deleted_at`,
    `created_at`,
    `updated_at`
)
SELECT
    `user_id`,
    `project_id`,
    NULL,
    IF(`deleted_at` IS NULL, 1, 0),
    `deleted_at`,
    `created_at`,
    `updated_at`
FROM `storyteller_project_favorites`;

DROP TABLE `storyteller_project_favorites`;

-- +migrate Down
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

INSERT INTO `storyteller_project_favorites` (
    `user_id`,
    `project_id`,
    `deleted_at`,
    `created_at`,
    `updated_at`
)
SELECT
    `user_id`,
    `project_id`,
    IF(`is_favorite` = 1, NULL, `updated_at`),
    `created_at`,
    `updated_at`
FROM `storyteller_project_rankings`
WHERE `is_favorite` = 1 OR `deleted_at` IS NOT NULL;

DROP TABLE `storyteller_project_rankings`;

ALTER TABLE `storyteller_story_versions`
    DROP COLUMN `word_count`;

ALTER TABLE `storyteller_stories`
    DROP COLUMN `word_count`;

ALTER TABLE `storyteller_projects`
    ADD COLUMN `rating_count` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `share_token`,
    ADD COLUMN `rating_total` DECIMAL(12,1) NOT NULL DEFAULT 0.0 AFTER `rating_count`;
