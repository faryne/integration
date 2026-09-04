-- +migrate Up
-- 作者在編輯頁加的筆記型書籤（跟讀者閱讀頁的 storyteller_story_bookmarks 無關）。
-- story_id / lore_id 二選一，由應用層保證；MySQL 5.7 不強制 CHECK。
-- Unique 拆成兩組：NULL 在 5.7 unique index 裡不互斥，所以 story 書籤靠
-- (story_id, user_id, marker_id)、lore 書籤靠 (lore_id, user_id, marker_id)。
CREATE TABLE `storyteller_writing_bookmarks` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `story_id` BIGINT UNSIGNED NULL COMMENT '所屬故事，跟 lore_id 二選一',
    `lore_id` BIGINT UNSIGNED NULL COMMENT '所屬設定集，跟 story_id 二選一',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '書籤作者（登入使用者）',
    `marker_id` VARCHAR(64) NOT NULL COMMENT '對應段落的 markerId',
    `note` TEXT NULL COMMENT '可留空，單純標記這個位置',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_writing_bookmarks_story_user_marker` (`story_id`, `user_id`, `marker_id`),
    UNIQUE KEY `idx_writing_bookmarks_lore_user_marker` (`lore_id`, `user_id`, `marker_id`),
    KEY `idx_writing_bookmarks_user_story` (`user_id`, `story_id`),
    KEY `idx_writing_bookmarks_user_lore` (`user_id`, `lore_id`),
    CONSTRAINT `fk_writing_bookmarks_story`
        FOREIGN KEY (`story_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_writing_bookmarks_lore`
        FOREIGN KEY (`lore_id`) REFERENCES `storyteller_lores` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_writing_bookmarks_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_writing_bookmarks`;
