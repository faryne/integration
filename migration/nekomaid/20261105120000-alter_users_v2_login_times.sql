-- 我的追蹤 → 畫師 tab 要列出「前一次登入～本次登入」之間新增的作品，登入成功時輪替這兩個時間。

-- +migrate Up
ALTER TABLE `users_v2`
  ADD COLUMN `previous_login_at` datetime DEFAULT NULL COMMENT '前一次登入時間' AFTER `email_verified_at`,
  ADD COLUMN `current_login_at` datetime DEFAULT NULL COMMENT '本次（最近一次）登入時間' AFTER `previous_login_at`;

-- +migrate Down
ALTER TABLE `users_v2`
  DROP COLUMN `previous_login_at`,
  DROP COLUMN `current_login_at`;
