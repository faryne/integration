-- +migrate Up
ALTER TABLE `storyteller_agents`
    ADD COLUMN `api_key_encrypted` TEXT NULL AFTER `api_key`,
    ADD COLUMN `api_key_data_key` TEXT NULL AFTER `api_key_encrypted`,
    ADD COLUMN `api_key_key_id` VARCHAR(64) NULL AFTER `api_key_data_key`;

-- +migrate Down
ALTER TABLE `storyteller_agents`
    DROP COLUMN `api_key_key_id`,
    DROP COLUMN `api_key_data_key`,
    DROP COLUMN `api_key_encrypted`;
