-- +migrate Up
ALTER TABLE `webshot_history`
    ADD COLUMN `screenshot_duration_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '截圖與圖片處理耗費時間，單位毫秒' AFTER `thumb_image_path`,
    ADD COLUMN `upload_duration_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '圖片上傳耗費時間，單位毫秒' AFTER `screenshot_duration_ms`;

-- +migrate Down
ALTER TABLE `webshot_history`
    DROP COLUMN `upload_duration_ms`,
    DROP COLUMN `screenshot_duration_ms`;
