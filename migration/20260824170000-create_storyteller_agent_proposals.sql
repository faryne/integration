-- +migrate Up
-- storyteller_agent_proposals 把 AI 助理提出的寫入類提案（storyteller_upsert_story
-- 等被 CaptureWriteToolsAsProposals 攔下來的呼叫）變成有身份的資料列，取代原本只
-- 存在 storyteller_story_chat_messages.metadata JSON 快照裡的做法——JSON 快照是
-- 唯讀的歷史記錄，沒有地方記「使用者後來按了套用還是否決」，重新整理頁面就會
-- 看起來一直是「待確認」。chat_id 對應 storyteller_story_chats（每輪 agentic
-- 對話都會建一筆新的 chat，一個 chat 剛好對應一則 assistant 訊息，不需要另外存
-- message_id）。
CREATE TABLE `storyteller_agent_proposals` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL COMMENT '對外使用的提案 id，避免暴露流水號',
    `chat_id` BIGINT UNSIGNED NOT NULL COMMENT '所屬 storyteller_story_chats，藉此反查 project/story/lore 範圍與擁有者',
    `tool_call_id` VARCHAR(64) NOT NULL COMMENT 'AI 這輪對話裡這次呼叫的 tool_call id，純顯示排序用途',
    `tool_name` VARCHAR(64) NOT NULL COMMENT '寫入類工具名稱，例如 storyteller_upsert_story',
    `arguments` JSON NOT NULL COMMENT 'AI 呼叫這個工具時傳的參數，套用時原樣執行',
    `status` ENUM('pending', 'applied', 'rejected') NOT NULL DEFAULT 'pending',
    `applied_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_agent_proposals_public_id` (`public_id`),
    KEY `idx_storyteller_agent_proposals_chat` (`chat_id`),
    CONSTRAINT `fk_storyteller_agent_proposals_chat`
        FOREIGN KEY (`chat_id`) REFERENCES `storyteller_story_chats` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_agent_proposals`;
