-- +migrate Up
ALTER TABLE `storyteller_agent_models`
    ADD COLUMN `description` TEXT NULL AFTER `label`,
    ADD COLUMN `price` TEXT NULL AFTER `description`;

-- +migrate Down
ALTER TABLE `storyteller_agent_models`
    DROP COLUMN `price`,
    DROP COLUMN `description`;
