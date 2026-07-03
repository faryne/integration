-- +migrate Up
-- 現有金鑰皆已加密（CreateProviderAPIKey 一律加密後才寫入，搬遷過來的舊資料也已確認加密過），
-- api_key 明文欄位不再需要，加解密邏輯也已移除對它的 fallback。
ALTER TABLE `storyteller_provider_apikeys`
    DROP COLUMN `api_key`;

-- +migrate Down
ALTER TABLE `storyteller_provider_apikeys`
    ADD COLUMN `api_key` TEXT NULL AFTER `label`;
