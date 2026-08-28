-- +migrate Up
ALTER TABLE `storyteller_agent_usage_logs`
    DROP FOREIGN KEY `fk_storyteller_agent_usage_logs_agent`,
    DROP INDEX `idx_storyteller_agent_usage_logs_key_agent_time`,
    DROP COLUMN `agent_id`,
    ADD INDEX `idx_storyteller_agent_usage_logs_key_time` (`provider_apikey_id`, `created_at`);

-- +migrate Down
ALTER TABLE `storyteller_agent_usage_logs`
    DROP INDEX `idx_storyteller_agent_usage_logs_key_time`,
    ADD COLUMN `agent_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '該次執行使用的 Agent' AFTER `provider_apikey_id`,
    ADD INDEX `idx_storyteller_agent_usage_logs_key_agent_time` (`provider_apikey_id`, `agent_id`, `created_at`),
    ADD CONSTRAINT `fk_storyteller_agent_usage_logs_agent`
        FOREIGN KEY (`agent_id`) REFERENCES `storyteller_agents` (`id`) ON DELETE CASCADE;
