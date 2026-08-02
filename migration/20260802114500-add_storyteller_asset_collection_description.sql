-- +migrate Up
ALTER TABLE `storyteller_asset_collections`
    ADD COLUMN `description` TEXT NULL
        COMMENT '資產集用途筆記，可不填寫' AFTER `name`;

-- +migrate Down
ALTER TABLE `storyteller_asset_collections`
    DROP COLUMN `description`;
