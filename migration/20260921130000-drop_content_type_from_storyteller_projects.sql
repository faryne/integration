-- +migrate Up
-- 專案層級的 content_type 已無實際作用（行為都由每話／每冊自己的 content_type 決定），整欄移除。
ALTER TABLE `storyteller_projects`
    DROP COLUMN `content_type`;

-- +migrate Down
ALTER TABLE `storyteller_projects`
    ADD COLUMN `content_type` VARCHAR(16) NOT NULL DEFAULT 'text' COMMENT 'text, image' AFTER `rating`;

-- 盡力回填：專案底下有未刪除的話（image）且沒有文字故事時標為 image，其餘維持 text
UPDATE `storyteller_projects` AS `p`
SET `p`.`content_type` = 'image'
WHERE EXISTS (
        SELECT 1 FROM `storyteller_stories` AS `s`
        WHERE `s`.`project_id` = `p`.`id` AND `s`.`is_volume` = 0 AND `s`.`is_deleted` = 0 AND `s`.`deleted_at` IS NULL AND `s`.`content_type` = 'image'
    )
    AND NOT EXISTS (
        SELECT 1 FROM `storyteller_stories` AS `s`
        WHERE `s`.`project_id` = `p`.`id` AND `s`.`is_volume` = 0 AND `s`.`is_deleted` = 0 AND `s`.`deleted_at` IS NULL AND `s`.`content_type` = 'text'
    );
