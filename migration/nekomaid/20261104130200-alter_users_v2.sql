-- 使用者表準備接 Firebase（獨立 nekomaid 專案）：綁定 firebase_uid、補 soft delete 與更新時間。
-- id 不動，users_fav_* 的 user_id 照舊對得上。

-- +migrate Up
ALTER TABLE `users_v2` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `users_v2`
  ADD COLUMN `firebase_uid` varchar(128) DEFAULT NULL COMMENT 'Firebase UID（nekomaid 專案）' AFTER `id`,
  ADD COLUMN `updated_at` datetime DEFAULT NULL AFTER `created_on`,
  ADD COLUMN `is_deleted` tinyint(1) NOT NULL DEFAULT '0' AFTER `updated_at`,
  ADD COLUMN `deleted_at` datetime DEFAULT NULL AFTER `is_deleted`,
  ADD UNIQUE KEY `uk_firebase_uid` (`firebase_uid`),
  ADD KEY `idx_email` (`email`);

-- +migrate Down
ALTER TABLE `users_v2`
  DROP KEY `uk_firebase_uid`,
  DROP KEY `idx_email`,
  DROP COLUMN `firebase_uid`,
  DROP COLUMN `updated_at`,
  DROP COLUMN `is_deleted`,
  DROP COLUMN `deleted_at`;
ALTER TABLE `users_v2` CONVERT TO CHARACTER SET utf8 COLLATE utf8_general_ci;
