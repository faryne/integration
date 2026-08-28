-- +migrate Up
ALTER TABLE `storyteller_agent_usage_logs`
    ADD COLUMN `price` TEXT NULL COMMENT '執行當下查到的單價快照（每 token 美金，JSON），查不到就是 NULL' AFTER `model_name`;

-- +migrate Down
ALTER TABLE `storyteller_agent_usage_logs`
    DROP COLUMN `price`;
