-- +migrate Up
CREATE TABLE `storyteller_assets` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL COMMENT '對外使用的資產 id，避免暴露流水號',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '資產擁有者快照，權限檢查仍以 project.user_id 為準',
    `project_id` BIGINT UNSIGNED NOT NULL COMMENT '資產所屬專案；資產不可跨專案引用',
    `asset_type` VARCHAR(16) NOT NULL COMMENT 'image/audio/video；第一版只開放 image',
    `mime_type` VARCHAR(128) NOT NULL COMMENT '上傳檔案的 MIME type',
    `file_ext` VARCHAR(16) NOT NULL DEFAULT '' COMMENT '由 MIME 或檔名推得的副檔名，供 UI 顯示',
    `file_size` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'S3 HeadObject 回報的檔案大小',
    `metadata` JSON NULL COMMENT '媒體補充資訊，例如 image width/height，未來影音 duration/codec',
    `s3_key` VARCHAR(512) NOT NULL COMMENT 'S3 object key，讀取時才轉成 CloudFront 簽名 URL',
    `original_filename` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '使用者上傳時的原始檔名',
    `title` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '資產管理用標題',
    `alt_text` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '圖片替代文字',
    `description` TEXT NULL COMMENT '資產備註',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '軟刪除旗標',
    `deleted_at` TIMESTAMP NULL DEFAULT NULL COMMENT '軟刪除時間',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_assets_public_id` (`public_id`),
    KEY `idx_storyteller_assets_user_project_type` (`user_id`, `project_id`, `asset_type`, `is_deleted`, `created_at`),
    KEY `idx_storyteller_assets_project_type` (`project_id`, `asset_type`, `is_deleted`, `created_at`),
    KEY `idx_storyteller_assets_s3_key` (`s3_key`),
    CONSTRAINT `fk_storyteller_assets_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_assets_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_asset_references` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `asset_id` BIGINT UNSIGNED NOT NULL COMMENT '被引用的資產',
    `target_type` VARCHAR(32) NOT NULL COMMENT 'story/lore/image_story_page 等引用來源',
    `target_id` BIGINT UNSIGNED NOT NULL COMMENT '引用來源資料列 id',
    `target_version_id` BIGINT UNSIGNED NULL COMMENT '可選版本 id；第一版先保留給後續 editor 整合',
    `reference_key` VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'markdown token 或 page id，方便 debug',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_storyteller_asset_references_asset` (`asset_id`),
    KEY `idx_storyteller_asset_references_target` (`target_type`, `target_id`),
    CONSTRAINT `fk_storyteller_asset_references_asset`
        FOREIGN KEY (`asset_id`) REFERENCES `storyteller_assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_asset_references`;
DROP TABLE `storyteller_assets`;
