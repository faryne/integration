-- +migrate Up
ALTER TABLE `storyteller_provider_apikeys`
    ADD COLUMN `last_tested_at` TIMESTAMP NULL DEFAULT NULL AFTER `api_key_key_id`,
    ADD COLUMN `last_test_ok` TINYINT(1) NULL DEFAULT NULL COMMENT 'NULL = never tested' AFTER `last_tested_at`;

-- +migrate Down
ALTER TABLE `storyteller_provider_apikeys`
    DROP COLUMN `last_test_ok`,
    DROP COLUMN `last_tested_at`;
