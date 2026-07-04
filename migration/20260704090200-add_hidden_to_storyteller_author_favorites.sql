-- +migrate Up
ALTER TABLE `storyteller_author_favorites`
    ADD COLUMN `hidden` TINYINT(1) NOT NULL DEFAULT 0 AFTER `author_user_id`;

-- +migrate Down
ALTER TABLE `storyteller_author_favorites`
    DROP COLUMN `hidden`;
