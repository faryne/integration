
-- +migrate Up
ALTER TABLE `storyteller_stories`
    ADD COLUMN `parent_id` BIGINT UNSIGNED NULL COMMENT '所屬冊的 story id，NULL 代表未分冊或本身就是一冊' AFTER `project_id`,
    ADD COLUMN `is_volume` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否為冊（只有標題、不含內容的容器故事，不能巢狀）' AFTER `parent_id`,
    ADD KEY `idx_storyteller_stories_parent` (`parent_id`),
    ADD CONSTRAINT `fk_storyteller_stories_parent`
        FOREIGN KEY (`parent_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE SET NULL;

-- +migrate Down
ALTER TABLE `storyteller_stories`
    DROP FOREIGN KEY `fk_storyteller_stories_parent`,
    DROP KEY `idx_storyteller_stories_parent`,
    DROP COLUMN `is_volume`,
    DROP COLUMN `parent_id`;
