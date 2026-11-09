-- +migrate Up
-- joyu.fyi 討論版：留言掛在女優（domain:aid）或影片（DMM 內部番號）底下，只有一層回覆；不能編輯、不能刪除（只有後台能刪）

-- joyu 帳號的站內資料：只有暱稱與刪除狀態，不存 email、Google 名稱
CREATE TABLE IF NOT EXISTS `joyu_users` (
  `firebase_uid` VARCHAR(128) NOT NULL,
  `nickname` VARCHAR(32) NOT NULL DEFAULT '' COMMENT '討論版顯示的暱稱（只有 Google 帳號能設）',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '刪帳號：留言保留，名字改顯示「已刪除的帳號」',
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`firebase_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `joyu_comments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `target_type` VARCHAR(16) NOT NULL COMMENT 'actress / video',
  `target_key` VARCHAR(64) NOT NULL COMMENT 'actress: domain:aid；video: DMM 內部番號（小寫）',
  `firebase_uid` VARCHAR(128) NOT NULL,
  `is_anonymous` TINYINT(1) NOT NULL COMMENT '留言當下的帳號類型',
  `body` TEXT NOT NULL COMMENT '原始 Markdown',
  `parent_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 = 頂層留言；回覆指向頂層留言（只有一層）',
  `reply_to_uid` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '回覆別人的回覆時，對方是誰（顯示 @暱稱）',
  `ip` VARCHAR(45) NOT NULL DEFAULT '',
  `report_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `deleted_by` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '刪除的後台管理員（faryne.dev users.id）',
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_joyu_comments_target` (`target_type`, `target_key`, `parent_id`, `created_at`),
  KEY `idx_joyu_comments_parent` (`parent_id`, `created_at`),
  KEY `idx_joyu_comments_uid` (`firebase_uid`, `created_at`),
  KEY `idx_joyu_comments_reported` (`report_count`, `created_at`),
  KEY `idx_joyu_comments_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `joyu_comment_reports` (
  `comment_id` BIGINT UNSIGNED NOT NULL,
  `firebase_uid` VARCHAR(128) NOT NULL,
  `reason` VARCHAR(16) NOT NULL COMMENT 'spam / harass / privacy / other',
  `ip` VARCHAR(45) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`comment_id`, `firebase_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `joyu_bans` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ban_type` VARCHAR(8) NOT NULL COMMENT 'uid / ip',
  `value` VARCHAR(128) NOT NULL,
  `reason` VARCHAR(255) NOT NULL DEFAULT '',
  `expires_at` DATETIME NULL COMMENT 'NULL = 永久',
  `created_by` BIGINT UNSIGNED NOT NULL COMMENT '後台管理員（faryne.dev users.id）',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '解除封鎖',
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_joyu_bans_value` (`ban_type`, `value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `joyu_bans`;
DROP TABLE IF EXISTS `joyu_comment_reports`;
DROP TABLE IF EXISTS `joyu_comments`;
DROP TABLE IF EXISTS `joyu_users`;
