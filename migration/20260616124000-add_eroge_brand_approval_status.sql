-- +migrate Up
ALTER TABLE `eroge_brands`
    ADD COLUMN `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' AFTER `uploads_playlist_id`,
    ADD COLUMN `submitted_by_user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `status`,
    ADD COLUMN `approved_by_user_id` BIGINT UNSIGNED NULL AFTER `submitted_by_user_id`,
    ADD COLUMN `approved_at` DATETIME(3) NULL AFTER `approved_by_user_id`,
    ADD KEY `idx_eroge_brands_status` (`status`),
    ADD KEY `idx_eroge_brands_submitted_by_user_id` (`submitted_by_user_id`),
    ADD CONSTRAINT `fk_eroge_brands_approved_by_user`
        FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- +migrate Down
ALTER TABLE `eroge_brands`
    DROP FOREIGN KEY `fk_eroge_brands_approved_by_user`,
    DROP KEY `idx_eroge_brands_submitted_by_user_id`,
    DROP KEY `idx_eroge_brands_status`,
    DROP COLUMN `approved_at`,
    DROP COLUMN `approved_by_user_id`,
    DROP COLUMN `submitted_by_user_id`,
    DROP COLUMN `status`;
