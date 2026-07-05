-- +migrate Up
CREATE TABLE `storyteller_story_bookmarks` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '加入書籤的使用者',
    `story_id` BIGINT UNSIGNED NOT NULL COMMENT '所屬故事（章節）',
    `story_version_id` BIGINT UNSIGNED NOT NULL COMMENT '書籤當下對應的故事版本',
    `line_index` INT UNSIGNED NOT NULL COMMENT '該版本內容中的行號（0-based）',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_story_bookmarks_unique` (`user_id`, `story_version_id`, `line_index`),
    KEY `idx_storyteller_story_bookmarks_user_story` (`user_id`, `story_id`),
    KEY `idx_storyteller_story_bookmarks_version` (`story_version_id`),
    CONSTRAINT `fk_storyteller_story_bookmarks_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_story_bookmarks_story`
        FOREIGN KEY (`story_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_story_bookmarks_version`
        FOREIGN KEY (`story_version_id`) REFERENCES `storyteller_story_versions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_story_bookmarks`;
