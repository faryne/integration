-- +migrate Up
-- 純除錯用欄位：存放這則 assistant 訊息生成過程中，每一次 provider.Generate()
-- 呼叫收到的原始 HTTP response body（JSON 陣列，一個字元都沒有精簡），用來
-- 對照 provider 自己 console 上的紀錄，追查「這輪對話實際上打了幾次、各自
-- 收到什麼」。跟已經存在的 metadata（解析過的 tool_calls/results 摘要）分開存，
-- 不影響既有欄位。可能之後會刪掉，不透過 API 輸出。
ALTER TABLE `storyteller_story_chat_messages`
    ADD COLUMN `raw_provider_response` LONGTEXT NULL AFTER `metadata`;

-- +migrate Down
ALTER TABLE `storyteller_story_chat_messages` DROP COLUMN `raw_provider_response`;
