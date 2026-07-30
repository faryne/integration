
-- +migrate Up
ALTER TABLE `storyteller_projects`
    ADD COLUMN `content_type` VARCHAR(16) NOT NULL DEFAULT 'text' COMMENT 'text, image' AFTER `rating`;

-- +migrate Down
ALTER TABLE `storyteller_projects`
    DROP COLUMN `content_type`;
