-- +migrate Up
ALTER TABLE `storyteller_project_rankings`
    ADD COLUMN `favorite_hidden` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_favorite`;

-- +migrate Down
ALTER TABLE `storyteller_project_rankings`
    DROP COLUMN `favorite_hidden`;
