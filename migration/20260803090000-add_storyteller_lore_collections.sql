-- +migrate Up
CREATE TABLE `storyteller_lore_collections` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL COMMENT '對外使用的設定集分類 id，避免暴露流水號',
    `project_id` BIGINT UNSIGNED NOT NULL COMMENT '分類所屬專案；設定集分類不可跨專案使用',
    `name` VARCHAR(255) NOT NULL COMMENT '分類名稱',
    `description` TEXT NULL COMMENT '分類用途筆記，可不填寫',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '分類排序值',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '軟刪除旗標',
    `deleted_at` TIMESTAMP NULL DEFAULT NULL COMMENT '軟刪除時間',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_lore_collections_public_id` (`public_id`),
    KEY `idx_storyteller_lore_collections_project_sort` (`project_id`, `is_deleted`, `sort`, `id`),
    CONSTRAINT `fk_storyteller_lore_collections_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `storyteller_lores`
    ADD COLUMN `collection_id` BIGINT UNSIGNED NULL COMMENT '設定集分類 id，NULL 代表未分類' AFTER `project_id`,
    ADD KEY `idx_storyteller_lores_collection_updated` (`collection_id`, `is_deleted`, `updated_at`),
    ADD CONSTRAINT `fk_storyteller_lores_collection`
        FOREIGN KEY (`collection_id`) REFERENCES `storyteller_lore_collections` (`id`) ON DELETE SET NULL;

-- +migrate Down
ALTER TABLE `storyteller_lores`
    DROP FOREIGN KEY `fk_storyteller_lores_collection`,
    DROP KEY `idx_storyteller_lores_collection_updated`,
    DROP COLUMN `collection_id`;

DROP TABLE `storyteller_lore_collections`;
