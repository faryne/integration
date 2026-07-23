-- +migrate Up
ALTER TABLE `storyteller_stories`
    ADD COLUMN `latest_version_id` BIGINT UNSIGNED NULL AFTER `latest_content`,
    ADD KEY `idx_storyteller_stories_latest_version` (`latest_version_id`),
    ADD CONSTRAINT `fk_storyteller_stories_latest_version`
        FOREIGN KEY (`latest_version_id`) REFERENCES `storyteller_story_versions` (`id`) ON DELETE SET NULL;

ALTER TABLE `storyteller_lores`
    ADD COLUMN `latest_version_id` BIGINT UNSIGNED NULL AFTER `latest_content`,
    ADD KEY `idx_storyteller_lores_latest_version` (`latest_version_id`),
    ADD CONSTRAINT `fk_storyteller_lores_latest_version`
        FOREIGN KEY (`latest_version_id`) REFERENCES `storyteller_lore_versions` (`id`) ON DELETE SET NULL;

-- 補齊既有資料：每篇故事/設定集目前最新的一筆版本 id。
UPDATE `storyteller_stories` AS `stories`
SET `stories`.`latest_version_id` = (
    SELECT `v`.`id` FROM `storyteller_story_versions` AS `v`
    WHERE `v`.`story_id` = `stories`.`id` AND `v`.`deleted_at` IS NULL
    ORDER BY `v`.`created_at` DESC, `v`.`id` DESC LIMIT 1
);

UPDATE `storyteller_lores` AS `lores`
SET `lores`.`latest_version_id` = (
    SELECT `v`.`id` FROM `storyteller_lore_versions` AS `v`
    WHERE `v`.`lore_id` = `lores`.`id` AND `v`.`deleted_at` IS NULL
    ORDER BY `v`.`created_at` DESC, `v`.`id` DESC LIMIT 1
);

-- reverted_from_version_id：這個版本是使用者「回復到某個舊版本」產生的，記錄回復的來源版本。
-- conflicted_with_version_id：存檔當下 base_version_id 已經不是最新版本，記錄當時真正最新的那個版本，
-- 讓編輯歷史事後也能看出哪些版本是蓋在衝突上的，不只依賴當次回應裡的提示。
ALTER TABLE `storyteller_story_versions`
    ADD COLUMN `reverted_from_version_id` BIGINT UNSIGNED NULL AFTER `source`,
    ADD COLUMN `conflicted_with_version_id` BIGINT UNSIGNED NULL AFTER `reverted_from_version_id`,
    ADD CONSTRAINT `fk_storyteller_story_versions_reverted_from`
        FOREIGN KEY (`reverted_from_version_id`) REFERENCES `storyteller_story_versions` (`id`) ON DELETE SET NULL,
    ADD CONSTRAINT `fk_storyteller_story_versions_conflicted_with`
        FOREIGN KEY (`conflicted_with_version_id`) REFERENCES `storyteller_story_versions` (`id`) ON DELETE SET NULL;

ALTER TABLE `storyteller_lore_versions`
    ADD COLUMN `reverted_from_version_id` BIGINT UNSIGNED NULL AFTER `source`,
    ADD COLUMN `conflicted_with_version_id` BIGINT UNSIGNED NULL AFTER `reverted_from_version_id`,
    ADD CONSTRAINT `fk_storyteller_lore_versions_reverted_from`
        FOREIGN KEY (`reverted_from_version_id`) REFERENCES `storyteller_lore_versions` (`id`) ON DELETE SET NULL,
    ADD CONSTRAINT `fk_storyteller_lore_versions_conflicted_with`
        FOREIGN KEY (`conflicted_with_version_id`) REFERENCES `storyteller_lore_versions` (`id`) ON DELETE SET NULL;

-- +migrate Down
ALTER TABLE `storyteller_lore_versions`
    DROP FOREIGN KEY `fk_storyteller_lore_versions_conflicted_with`,
    DROP FOREIGN KEY `fk_storyteller_lore_versions_reverted_from`,
    DROP COLUMN `conflicted_with_version_id`,
    DROP COLUMN `reverted_from_version_id`;

ALTER TABLE `storyteller_story_versions`
    DROP FOREIGN KEY `fk_storyteller_story_versions_conflicted_with`,
    DROP FOREIGN KEY `fk_storyteller_story_versions_reverted_from`,
    DROP COLUMN `conflicted_with_version_id`,
    DROP COLUMN `reverted_from_version_id`;

ALTER TABLE `storyteller_lores`
    DROP FOREIGN KEY `fk_storyteller_lores_latest_version`,
    DROP KEY `idx_storyteller_lores_latest_version`,
    DROP COLUMN `latest_version_id`;

ALTER TABLE `storyteller_stories`
    DROP FOREIGN KEY `fk_storyteller_stories_latest_version`,
    DROP KEY `idx_storyteller_stories_latest_version`,
    DROP COLUMN `latest_version_id`;
