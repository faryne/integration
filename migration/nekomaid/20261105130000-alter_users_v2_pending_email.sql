-- 改版前的舊帳號在整合（email 驗證）前可以修改 email：驗證信寄到新信箱，點了才真的換。
-- pending_email 記下等待驗證的新信箱（提示條顯示用），套用連結後清空。

-- +migrate Up
ALTER TABLE `users_v2`
  ADD COLUMN `pending_email` varchar(100) DEFAULT NULL COMMENT '等待驗證的新 email（點了驗證信才換）' AFTER `email`;

-- +migrate Down
ALTER TABLE `users_v2` DROP COLUMN `pending_email`;
