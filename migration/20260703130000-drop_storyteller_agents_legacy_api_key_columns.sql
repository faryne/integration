-- +migrate Up
-- 20260703120000 已經把 storyteller_agents 上的金鑰資料搬到 storyteller_provider_apikeys，
-- 程式碼也改為只透過 provider_apikey_id 讀取，這四欄已無任何用途。
ALTER TABLE `storyteller_agents`
    DROP COLUMN `api_key`,
    DROP COLUMN `api_key_encrypted`,
    DROP COLUMN `api_key_data_key`,
    DROP COLUMN `api_key_key_id`;

-- +migrate Down
ALTER TABLE `storyteller_agents`
    ADD COLUMN `api_key` TEXT NULL AFTER `provider_apikey_id`,
    ADD COLUMN `api_key_encrypted` TEXT NULL AFTER `api_key`,
    ADD COLUMN `api_key_data_key` TEXT NULL AFTER `api_key_encrypted`,
    ADD COLUMN `api_key_key_id` VARCHAR(64) NULL AFTER `api_key_data_key`;
