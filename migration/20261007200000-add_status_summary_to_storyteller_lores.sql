-- +migrate Up
-- 設定對讀者公開：status 沿用故事的 draft/completed，預設不公開（設定裡常有作者的私人筆記與未揭露伏筆）；
-- summary 給設定列表與設定頁頂端顯示
ALTER TABLE `storyteller_lores`
    ADD COLUMN `status` VARCHAR(16) NOT NULL DEFAULT 'draft' COMMENT 'draft = author only, completed = visible to readers' AFTER `title`,
    ADD COLUMN `summary` VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'Reader-facing summary shown in lore lists' AFTER `status`,
    ADD KEY `idx_storyteller_lores_project_status` (`project_id`, `status`);

-- +migrate Down
ALTER TABLE `storyteller_lores`
    DROP KEY `idx_storyteller_lores_project_status`,
    DROP COLUMN `summary`,
    DROP COLUMN `status`;
