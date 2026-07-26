
-- +migrate Up
CREATE TABLE `storyteller_story_volume_events` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `story_id` BIGINT UNSIGNED NOT NULL COMMENT '隸屬關係異動的故事',
    `from_volume_id` BIGINT UNSIGNED NULL COMMENT '異動前所屬的冊，NULL 代表異動前未分冊',
    `to_volume_id` BIGINT UNSIGNED NULL COMMENT '異動後所屬的冊，NULL 代表異動後未分冊（含故事被刪除的情況）',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_storyteller_story_volume_events_story` (`story_id`),
    KEY `idx_storyteller_story_volume_events_from` (`from_volume_id`),
    KEY `idx_storyteller_story_volume_events_to` (`to_volume_id`),
    CONSTRAINT `fk_storyteller_story_volume_events_story`
        FOREIGN KEY (`story_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_story_volume_events_from`
        FOREIGN KEY (`from_volume_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_storyteller_story_volume_events_to`
        FOREIGN KEY (`to_volume_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_story_volume_events`;
