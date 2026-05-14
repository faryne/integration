-- +migrate Up
-- 2. 儲存截圖歷史紀錄（版本控制）
CREATE TABLE `webshot_history` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `main_id` BIGINT UNSIGNED NOT NULL COMMENT '關聯至 webshot_main.id',
    `full_image_path` VARCHAR(512) NOT NULL COMMENT '完整截圖檔名',
    `thumb_image_path` VARCHAR(512) NOT NULL COMMENT '縮圖檔名',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '擷取時間',
    CONSTRAINT `fk_page_history` FOREIGN KEY (`main_id`)
        REFERENCES `webshot_main`(`id`) ON DELETE CASCADE,
    INDEX `idx_page_time` (`main_id`, `created_at`)
) ENGINE=InnoDB;

-- +migrate Down
DROP TABLE `webshot_history`;
