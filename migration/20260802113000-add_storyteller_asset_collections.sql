-- +migrate Up
CREATE TABLE `storyteller_asset_collections` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL COMMENT '對外使用的 collection id，避免暴露流水號',
    `project_id` BIGINT UNSIGNED NOT NULL COMMENT 'collection 所屬專案',
    `name` VARCHAR(255) NOT NULL COMMENT 'collection 顯示名稱',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '專案內排序',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '軟刪除旗標',
    `deleted_at` TIMESTAMP NULL DEFAULT NULL COMMENT '軟刪除時間',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_asset_collections_public_id` (`public_id`),
    KEY `idx_storyteller_asset_collections_project_sort` (`project_id`, `is_deleted`, `sort`, `id`),
    CONSTRAINT `fk_storyteller_asset_collections_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `storyteller_assets`
    ADD COLUMN `collection_id` BIGINT UNSIGNED NULL
        COMMENT '所屬資產 collection，NULL 代表未分類' AFTER `project_id`,
    ADD KEY `idx_storyteller_assets_collection_type` (`collection_id`, `asset_type`, `is_deleted`, `created_at`),
    ADD CONSTRAINT `fk_storyteller_assets_collection`
        FOREIGN KEY (`collection_id`) REFERENCES `storyteller_asset_collections` (`id`) ON DELETE SET NULL;

-- +migrate Down
ALTER TABLE `storyteller_assets`
    DROP FOREIGN KEY `fk_storyteller_assets_collection`,
    DROP KEY `idx_storyteller_assets_collection_type`,
    DROP COLUMN `collection_id`;

DROP TABLE `storyteller_asset_collections`;
