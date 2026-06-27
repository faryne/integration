-- +migrate Up
ALTER TABLE `storyteller_stories`
    ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `word_count`,
    ADD KEY `idx_storyteller_stories_deleted` (`is_deleted`, `deleted_at`);

ALTER TABLE `storyteller_lores`
    ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `word_count`,
    ADD KEY `idx_storyteller_lores_deleted` (`is_deleted`, `deleted_at`);

-- 讓既有 soft delete 資料符合 is_deleted 與 deleted_at 成對標記的規則。
UPDATE `storyteller_stories`
SET `is_deleted` = 1
WHERE `deleted_at` IS NOT NULL;

UPDATE `storyteller_lores`
SET `is_deleted` = 1
WHERE `deleted_at` IS NOT NULL;

-- +migrate Down
ALTER TABLE `storyteller_lores`
    DROP KEY `idx_storyteller_lores_deleted`,
    DROP COLUMN `is_deleted`;

ALTER TABLE `storyteller_stories`
    DROP KEY `idx_storyteller_stories_deleted`,
    DROP COLUMN `is_deleted`;
