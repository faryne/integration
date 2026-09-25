-- +migrate Up
-- 模型可建議「這筆候選要取代哪筆既有記憶」；真正確認前只保存 public_id，
-- 確認時再以 user_id 與 scope 驗證並原子更新舊記憶的 superseded_by_id。
ALTER TABLE `storyteller_assistant_memories`
    ADD COLUMN `supersedes_public_id` VARCHAR(32) NULL AFTER `should_remember`,
    ADD KEY `idx_storyteller_assistant_memories_supersedes_public_id` (`supersedes_public_id`);

-- +migrate Down
ALTER TABLE `storyteller_assistant_memories`
    DROP KEY `idx_storyteller_assistant_memories_supersedes_public_id`,
    DROP COLUMN `supersedes_public_id`;
