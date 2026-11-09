-- +migrate Up
-- joyu.fyi 片單：想看／看過＋評分（只有 Firebase uid，不存帳號資料）
CREATE TABLE IF NOT EXISTS `joyu_video_marks` (
  `firebase_uid` VARCHAR(128) NOT NULL,
  `video_no` VARCHAR(32) NOT NULL COMMENT 'DMM 內部番號（小寫）',
  `status` VARCHAR(8) NOT NULL COMMENT 'want 想看 / watched 看過',
  `rating` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '1～5，0 = 未評分（只有看過才能評）',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`firebase_uid`, `video_no`),
  KEY `idx_uid_updated` (`firebase_uid`, `updated_at`),
  KEY `idx_video` (`video_no`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `joyu_video_marks`;
