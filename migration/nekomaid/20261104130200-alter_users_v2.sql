-- 使用者表準備接 Firebase（neko 專用專案）：綁定 firebase_uid、補 soft delete、合併與 email 驗證欄位。
-- id 不動，users_fav_* 的 user_id 照舊對得上。舊會員第一次登入時才搬進 Firebase（見規格 §2）。

-- +migrate Up
ALTER TABLE `users_v2` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `users_v2`
  ADD COLUMN `firebase_uid` varchar(128) DEFAULT NULL COMMENT 'Firebase UID（nekomaid 專案）' AFTER `id`,
  ADD COLUMN `updated_at` datetime DEFAULT NULL AFTER `created_on`,
  ADD COLUMN `is_deleted` tinyint(1) NOT NULL DEFAULT '0' AFTER `updated_at`,
  ADD COLUMN `deleted_at` datetime DEFAULT NULL AFTER `is_deleted`,
  ADD COLUMN `merged_into_id` int(10) DEFAULT NULL COMMENT '同 email 驗證後被合併到哪個帳號' AFTER `deleted_at`,
  ADD COLUMN `verification_sent_at` datetime DEFAULT NULL COMMENT '最後一次寄驗證信的時間；超過 24 小時未驗證就清除' AFTER `merged_into_id`,
  ADD COLUMN `email_verified_at` datetime DEFAULT NULL COMMENT 'email 驗證完成時間' AFTER `verification_sent_at`,
  ADD UNIQUE KEY `uk_firebase_uid` (`firebase_uid`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_unverified` (`is_deleted`, `email_verified_at`, `verification_sent_at`);

-- +migrate Down
ALTER TABLE `users_v2`
  DROP KEY `uk_firebase_uid`,
  DROP KEY `idx_email`,
  DROP KEY `idx_unverified`,
  DROP COLUMN `firebase_uid`,
  DROP COLUMN `updated_at`,
  DROP COLUMN `is_deleted`,
  DROP COLUMN `deleted_at`,
  DROP COLUMN `merged_into_id`,
  DROP COLUMN `verification_sent_at`,
  DROP COLUMN `email_verified_at`;
ALTER TABLE `users_v2` CONVERT TO CHARACTER SET utf8 COLLATE utf8_general_ci;
