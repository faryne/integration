-- +migrate Up
-- Agent 現在只是「使用者自建 skill」：名稱（/<名稱> 指令）加人設（default_prompt）。
-- provider／model／key 是每次呼叫的請求欄位（provider_apikey_id、model_name），不再屬於 Agent，
-- 這四欄在執行期已不再被讀取：provider、model_name、provider_apikey_id、agent_model_id。
-- 版本快照表 storyteller_agent_prompt_versions 的 provider／model_name 也一併移除（快照的來源沒了）。
--
-- 注意：
--   1. 不可逆的資料刪除：欄位內既有的值不會保留（Down 只還原欄位結構，值為預設／NULL）。
--   2. 部署順序：先跑 migration、再部署新程式碼（migration 跑完到新版上線之間，舊版程式碼會因欄位不存在而失敗）。
ALTER TABLE `storyteller_agents`
    DROP FOREIGN KEY `fk_storyteller_agents_agent_model`,
    DROP FOREIGN KEY `fk_storyteller_agents_provider_apikey`,
    DROP INDEX `idx_storyteller_agents_agent_model`,
    DROP INDEX `idx_storyteller_agents_provider_apikey`,
    DROP INDEX `idx_storyteller_agents_user_provider`,
    DROP COLUMN `agent_model_id`,
    DROP COLUMN `provider_apikey_id`,
    DROP COLUMN `provider`,
    DROP COLUMN `model_name`;

ALTER TABLE `storyteller_agent_prompt_versions`
    DROP COLUMN `provider`,
    DROP COLUMN `model_name`;

-- +migrate Down
ALTER TABLE `storyteller_agent_prompt_versions`
    ADD COLUMN `provider` VARCHAR(64) NOT NULL DEFAULT '' AFTER `name`,
    ADD COLUMN `model_name` VARCHAR(255) NOT NULL DEFAULT '' AFTER `provider`;

ALTER TABLE `storyteller_agents`
    ADD COLUMN `provider` VARCHAR(64) NOT NULL DEFAULT 'grok' AFTER `name`,
    ADD COLUMN `model_name` VARCHAR(255) NOT NULL DEFAULT '' AFTER `provider`,
    ADD COLUMN `agent_model_id` BIGINT UNSIGNED NULL AFTER `model_name`,
    ADD COLUMN `provider_apikey_id` BIGINT UNSIGNED NULL AFTER `agent_model_id`,
    ADD KEY `idx_storyteller_agents_user_provider` (`user_id`, `provider`),
    ADD KEY `idx_storyteller_agents_agent_model` (`agent_model_id`),
    ADD KEY `idx_storyteller_agents_provider_apikey` (`provider_apikey_id`),
    ADD CONSTRAINT `fk_storyteller_agents_agent_model`
        FOREIGN KEY (`agent_model_id`) REFERENCES `storyteller_agent_models` (`id`) ON DELETE SET NULL,
    ADD CONSTRAINT `fk_storyteller_agents_provider_apikey`
        FOREIGN KEY (`provider_apikey_id`) REFERENCES `storyteller_provider_apikeys` (`id`) ON DELETE SET NULL;
