-- +migrate Up
ALTER TABLE `storyteller_story_versions`
    ADD COLUMN `source` VARCHAR(64) NOT NULL DEFAULT 'web_manual' AFTER `content`;

ALTER TABLE `storyteller_lore_versions`
    ADD COLUMN `source` VARCHAR(64) NOT NULL DEFAULT 'web_manual' AFTER `content`;

-- +migrate Down
ALTER TABLE `storyteller_story_versions` DROP COLUMN `source`;
ALTER TABLE `storyteller_lore_versions` DROP COLUMN `source`;
