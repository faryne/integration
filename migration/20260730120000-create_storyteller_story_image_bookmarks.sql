-- +migrate Up
CREATE TABLE `storyteller_story_image_bookmarks` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '加入書籤的使用者',
    `story_id` BIGINT UNSIGNED NOT NULL COMMENT '所屬的話（content_type=image 的故事）',
    `page_id` VARCHAR(64) NOT NULL COMMENT '書籤指向的頁面 id（對應 StoryImagePage.ID，穩定不隨排序變動）',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_story_image_bookmarks_unique` (`user_id`, `story_id`, `page_id`),
    KEY `idx_storyteller_story_image_bookmarks_story` (`story_id`),
    CONSTRAINT `fk_storyteller_story_image_bookmarks_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_story_image_bookmarks_story`
        FOREIGN KEY (`story_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_story_image_bookmarks`;
