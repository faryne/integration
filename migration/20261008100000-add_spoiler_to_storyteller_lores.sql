-- +migrate Up
-- 防劇透：is_spoiler 標記設定含劇透；依賴清單記錄「讀者要先讀過哪些故事／設定」。
-- 是軟性閘門（讀者確認後一定讀得到），所以循環依賴不用擋，也不需要外鍵。
ALTER TABLE `storyteller_lores`
    ADD COLUMN `is_spoiler` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Spoiler lore: readers confirm before reading unless they finished every dependency' AFTER `summary`;

CREATE TABLE `storyteller_lore_dependencies` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `lore_id` BIGINT UNSIGNED NOT NULL COMMENT 'The spoiler lore being protected',
    `target_type` VARCHAR(16) NOT NULL COMMENT 'story (text or image episode) / lore',
    `target_id` BIGINT UNSIGNED NOT NULL COMMENT 'Must be in the same project; never the lore itself',
    `sort` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_lore_dependencies_target` (`lore_id`, `target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_lore_dependencies`;
ALTER TABLE `storyteller_lores` DROP COLUMN `is_spoiler`;
