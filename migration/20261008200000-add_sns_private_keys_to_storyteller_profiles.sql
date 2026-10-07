-- +migrate Up
-- SNS 連結可見性：記錄 sns_links 裡哪些 key 設成「僅自己」，公開輸出時濾掉。
-- 分開一欄而不是改 sns_links 的值形狀，讓 sns_links 的對外契約與既有資料完全不動；NULL＝全部公開。
ALTER TABLE `storyteller_users`
    ADD COLUMN `sns_private_keys` JSON NULL COMMENT 'sns_links keys visible only to the owner' AFTER `sns_links`;
ALTER TABLE `storyteller_author_profiles`
    ADD COLUMN `sns_private_keys` JSON NULL COMMENT 'sns_links keys visible only to the owner' AFTER `sns_links`;

-- +migrate Down
ALTER TABLE `storyteller_author_profiles` DROP COLUMN `sns_private_keys`;
ALTER TABLE `storyteller_users` DROP COLUMN `sns_private_keys`;
