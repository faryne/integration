-- +migrate Up
-- agentic query 原本是「跑完才一次寫入 chat + user 訊息 + assistant 訊息」，中途
-- timeout／process 被重啟就整輪憑空消失，連使用者問了什麼都找不到。改成送出當下
-- 先落地 user 訊息（chat 進 pending），provider 呼叫真的跑完才補 assistant 訊息
-- （chat 轉 completed）；in_progress 是重送時用來搶「這輪由我重試」資格的中繼狀態
-- （guarded update，避免兩個重送請求同時搶著把回覆寫進同一個 chat）。
ALTER TABLE `storyteller_story_chats`
    ADD COLUMN `status` ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'completed' AFTER `user_id`;

-- 既有資料一律先當成 completed（預設值），只有「這個 chat 底下真的沒有 assistant
-- 訊息」的才回填成 pending——這種舊資料本來就是撞到本次修復前的 bug（例如跑到
-- 步數上限前就整個中斷）留下的孤兒問題，回填成 pending 之後使用者就能直接用新的
-- 「重送」功能補完，不用整批當成髒資料丟掉。
UPDATE `storyteller_story_chats` c
SET c.status = 'pending'
WHERE NOT EXISTS (
    SELECT 1 FROM `storyteller_story_chat_messages` m
    WHERE m.chat_id = c.id AND m.role = 'assistant' AND m.deleted_at IS NULL
);

-- +migrate Down
ALTER TABLE `storyteller_story_chats` DROP COLUMN `status`;
