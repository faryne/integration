-- +migrate Up
-- 專案封面指向資產 id（不存 S3 key）：資產原地替換會換 key，輸出時再依當下 key 簽名。
-- 不加 FK：資產是軟刪，由 service 驗證與輸出時過濾。
ALTER TABLE `storyteller_projects`
    ADD COLUMN `cover_asset_id` BIGINT UNSIGNED NULL COMMENT '專案封面資產 id' AFTER `share_token`,
    ADD KEY `idx_storyteller_projects_cover_asset_id` (`cover_asset_id`);

-- +migrate Down
ALTER TABLE `storyteller_projects`
    DROP INDEX `idx_storyteller_projects_cover_asset_id`,
    DROP COLUMN `cover_asset_id`;
