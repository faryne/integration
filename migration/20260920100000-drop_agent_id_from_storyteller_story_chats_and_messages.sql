-- +migrate Up
-- AI 助理不再記錄「這個 chat／這則訊息是哪個 Agent 產生的」：人設與預設 key／model 由每次呼叫
-- URL 上的 :agent 決定，實際送出的內容（含 <Persona>）已完整存在 user message 的
-- metadata.request_xml，不需要在這兩張表另外留一份 Agent 關聯。
-- 注意：欄位內既有的 agent_id 值會隨欄位一起刪除，無法還原（Down 只還原欄位結構，值為 NULL）。
-- 部署順序：storyteller_story_chats.agent_id 是 NOT NULL 且沒有預設值，新版程式碼建立 chat 時不再寫入它，
-- 所以「新程式碼先上、migration 後跑」期間送出 AI 助理訊息會失敗；反過來「migration 先跑」則舊程式碼
-- 會因欄位不存在而失敗。需要在同一個維護窗口一起切換，或先拆成兩階段（先把 agent_id 改成可為 NULL，
-- 等新程式碼上線後再刪欄位）。
-- 連帶影響：storyteller_story_chats.agent_id 原本有 ON DELETE CASCADE，刪除 Agent 時會連帶刪掉
-- 它的對話紀錄；欄位移除後這個連動也一併消失，Agent 與對話紀錄從此互不影響。
ALTER TABLE `storyteller_story_chat_messages`
    DROP FOREIGN KEY `fk_storyteller_story_chat_messages_agent`,
    DROP INDEX `idx_storyteller_story_chat_messages_agent`,
    DROP COLUMN `agent_id`;

ALTER TABLE `storyteller_story_chats`
    DROP FOREIGN KEY `fk_storyteller_story_chats_agent`,
    DROP INDEX `idx_storyteller_story_chats_agent`,
    DROP COLUMN `agent_id`;

-- +migrate Down
-- 舊資料的 agent_id 已無法還原，所以還原成可為 NULL 且不重建外鍵（原本 chats.agent_id 是 NOT NULL
-- ＋ FK CASCADE，補回外鍵會讓既有資料無法通過）。
ALTER TABLE `storyteller_story_chats`
    ADD COLUMN `agent_id` BIGINT UNSIGNED NULL AFTER `lore_id`,
    ADD KEY `idx_storyteller_story_chats_agent` (`agent_id`);

ALTER TABLE `storyteller_story_chat_messages`
    ADD COLUMN `agent_id` BIGINT UNSIGNED NULL AFTER `chat_id`,
    ADD KEY `idx_storyteller_story_chat_messages_agent` (`agent_id`);
