-- +migrate Up
ALTER TABLE `storyteller_story_chats`
    MODIFY COLUMN `story_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `lore_id` BIGINT UNSIGNED NULL AFTER `story_id`,
    ADD KEY `idx_storyteller_story_chats_lore_updated` (`lore_id`, `updated_at`),
    ADD CONSTRAINT `fk_storyteller_story_chats_lore`
        FOREIGN KEY (`lore_id`) REFERENCES `storyteller_lores` (`id`) ON DELETE CASCADE;

-- +migrate Down
ALTER TABLE `storyteller_story_chats`
    DROP FOREIGN KEY `fk_storyteller_story_chats_lore`,
    DROP KEY `idx_storyteller_story_chats_lore_updated`,
    DROP COLUMN `lore_id`,
    MODIFY COLUMN `story_id` BIGINT UNSIGNED NOT NULL;
