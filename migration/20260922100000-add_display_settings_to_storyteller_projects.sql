-- +migrate Up
-- 作品首頁／閱讀頁的顯示設定，結構由應用層 Go 型別（ProjectDisplaySettings）定義，
-- 不在這裡列欄位，避免跟著程式碼走鐘後這段註解變成誤導。
ALTER TABLE `storyteller_projects`
    ADD COLUMN `display_settings` JSON NULL DEFAULT NULL AFTER `cover_asset_id`;

-- +migrate Down
ALTER TABLE `storyteller_projects`
    DROP COLUMN `display_settings`;
