-- 版權申告（作品頁送出的禁抓申請）：不需登入，一律人工審核，核准後才寫進 artwork_forbidden。
-- 範圍最大到畫師：artwork_id 空字串＝整個畫師，有值＝只有那件作品。

-- +migrate Up
CREATE TABLE `artwork_forbidden_submissions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `token` char(32) NOT NULL COMMENT '申請人查詢審核狀態用的隨機 token',
  `site` varchar(15) NOT NULL COMMENT '來源站：pixiv / nico / tinami',
  `author_id` varchar(15) NOT NULL COMMENT '畫師 ID',
  `artwork_id` varchar(15) NOT NULL DEFAULT '' COMMENT '作品 ID；空字串＝整個畫師',
  `contact_email` varchar(255) NOT NULL DEFAULT '' COMMENT '聯絡 email（選填）',
  `message` text NOT NULL COMMENT '申告說明（選填，未填存空字串）',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT 'pending / approved / rejected',
  `reviewer_note` varchar(255) NOT NULL DEFAULT '' COMMENT '審核備註（駁回理由會顯示給申請人）',
  `reviewed_by` bigint(20) unsigned DEFAULT NULL COMMENT '審核的管理者（主站 users.id）',
  `reviewed_at` datetime DEFAULT NULL,
  `ip` varchar(45) NOT NULL DEFAULT '' COMMENT '送出者 IP（限流＋後台辨認大量惡意申告）',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token` (`token`),
  KEY `idx_status` (`is_deleted`,`status`,`created_at`),
  KEY `idx_ip` (`ip`,`created_at`) COMMENT '後台依 IP 查同一來源的申告'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='版權申告（禁抓申請）';

-- +migrate Down
DROP TABLE `artwork_forbidden_submissions`;
