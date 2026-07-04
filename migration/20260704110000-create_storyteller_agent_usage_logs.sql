-- +migrate Up
CREATE TABLE `storyteller_agent_usage_logs` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '所屬使用者',
    `provider_apikey_id` BIGINT UNSIGNED NOT NULL COMMENT '該次執行實際使用的 API Key（非 Agent 目前綁定的預設值）',
    `agent_id` BIGINT UNSIGNED NOT NULL COMMENT '該次執行使用的 Agent',
    `chat_id` BIGINT UNSIGNED NOT NULL COMMENT '對應的對話紀錄，用於回溯所屬故事或世界觀設定',
    `provider` VARCHAR(64) NOT NULL COMMENT '執行當下的 AI 供應商快照',
    `model_name` VARCHAR(255) NOT NULL COMMENT '執行當下使用的模型名稱快照',
    `input_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '輸入 token 數',
    `output_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '輸出 token 數',
    `total_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '總 token 數',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_storyteller_agent_usage_logs_key_agent_time` (`provider_apikey_id`, `agent_id`, `created_at`),
    KEY `idx_storyteller_agent_usage_logs_user_time` (`user_id`, `created_at`),
    KEY `idx_storyteller_agent_usage_logs_chat` (`chat_id`),
    CONSTRAINT `fk_storyteller_agent_usage_logs_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_agent_usage_logs_provider_apikey`
        FOREIGN KEY (`provider_apikey_id`) REFERENCES `storyteller_provider_apikeys` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_agent_usage_logs_agent`
        FOREIGN KEY (`agent_id`) REFERENCES `storyteller_agents` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_agent_usage_logs_chat`
        FOREIGN KEY (`chat_id`) REFERENCES `storyteller_story_chats` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_agent_usage_logs`;
