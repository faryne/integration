-- +migrate Up
-- 產生中的候選與已確認記憶共用同一筆資料：completed 只代表模型已整理完草稿，
-- confirmed 才會被注入 AI context。使用者關閉草稿不會讓半成品意外成為有效記憶。
ALTER TABLE `storyteller_assistant_memories`
    ADD COLUMN `memory_name` VARCHAR(255) NULL AFTER `public_id`,
    ADD COLUMN `source_chat_id` BIGINT UNSIGNED NULL AFTER `lore_id`,
    ADD COLUMN `provider_apikey_id` BIGINT UNSIGNED NULL AFTER `source_chat_id`,
    ADD COLUMN `model_name` VARCHAR(255) NULL AFTER `provider_apikey_id`,
    ADD COLUMN `input_tokens` INT UNSIGNED NULL AFTER `model_name`,
    ADD COLUMN `output_tokens` INT UNSIGNED NULL AFTER `input_tokens`,
    ADD COLUMN `status` VARCHAR(16) NOT NULL DEFAULT 'confirmed' COMMENT 'in_progress, completed, failed, confirmed' AFTER `output_tokens`,
    ADD COLUMN `should_remember` TINYINT(1) NULL AFTER `status`,
    ADD COLUMN `error_message` VARCHAR(500) NULL AFTER `should_remember`,
    ADD COLUMN `confirmed_at` TIMESTAMP NULL DEFAULT NULL AFTER `error_message`,
    ADD KEY `idx_storyteller_assistant_memories_user_status` (`user_id`, `status`, `is_deleted`, `updated_at`),
    ADD KEY `idx_storyteller_assistant_memories_source_chat` (`source_chat_id`),
    ADD KEY `idx_storyteller_assistant_memories_provider_apikey` (`provider_apikey_id`),
    ADD CONSTRAINT `fk_storyteller_assistant_memories_source_chat`
        FOREIGN KEY (`source_chat_id`) REFERENCES `storyteller_story_chats` (`id`) ON DELETE SET NULL,
    ADD CONSTRAINT `fk_storyteller_assistant_memories_provider_apikey`
        FOREIGN KEY (`provider_apikey_id`) REFERENCES `storyteller_provider_apikeys` (`id`) ON DELETE SET NULL;

-- +migrate Down
ALTER TABLE `storyteller_assistant_memories`
    DROP FOREIGN KEY `fk_storyteller_assistant_memories_provider_apikey`,
    DROP FOREIGN KEY `fk_storyteller_assistant_memories_source_chat`,
    DROP KEY `idx_storyteller_assistant_memories_provider_apikey`,
    DROP KEY `idx_storyteller_assistant_memories_source_chat`,
    DROP KEY `idx_storyteller_assistant_memories_user_status`,
    DROP COLUMN `confirmed_at`,
    DROP COLUMN `error_message`,
    DROP COLUMN `should_remember`,
    DROP COLUMN `status`,
    DROP COLUMN `output_tokens`,
    DROP COLUMN `input_tokens`,
    DROP COLUMN `model_name`,
    DROP COLUMN `provider_apikey_id`,
    DROP COLUMN `source_chat_id`,
    DROP COLUMN `memory_name`;
