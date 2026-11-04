-- 禁抓名單改版：MyISAM latin1 → InnoDB utf8mb4，加 id／soft delete／來源欄位，並支援「只禁單一作品」。
-- 舊版（PHP 與 Go）都只比對 site + author_id，artwork_id 從沒被用過，
-- 所以舊資料一律轉成「整個畫師」（artwork_id = ''），同一畫師的多列合併成一列，行為跟改版前一致。
-- 舊表改名成 artwork_forbidden_legacy 保留，Down 時換回去。

-- +migrate Up
CREATE TABLE `artwork_forbidden_v2` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `site` varchar(15) NOT NULL COMMENT '來源站：pixiv / nico / tinami',
  `author_id` varchar(15) NOT NULL COMMENT '畫師 ID',
  `artwork_id` varchar(15) NOT NULL DEFAULT '' COMMENT '作品 ID；空字串＝整個畫師',
  `source` varchar(20) NOT NULL DEFAULT 'admin' COMMENT '來源：admin 後台新增／submission 畫師申請／legacy 改版前舊資料',
  `submission_id` int(10) unsigned DEFAULT NULL COMMENT '來自畫師申請時對應 artwork_forbidden_submissions.id',
  `note` varchar(255) NOT NULL DEFAULT '' COMMENT '管理者備註',
  `created_by` bigint(20) unsigned DEFAULT NULL COMMENT '新增的管理者（主站 users.id）',
  `is_proceed` tinyint(1) NOT NULL DEFAULT '0' COMMENT '同步 job 是否已讓 ES 跟這列一致（生效中＝已拉掉，已解除＝已回補）',
  `finish_time` datetime DEFAULT NULL COMMENT '同步 job 完成時間',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已解除禁抓',
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_target` (`site`,`author_id`,`artwork_id`),
  KEY `idx_pending` (`is_deleted`,`is_proceed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='禁抓名單';

-- 舊資料 is_proceed 一律從 0 開始：改版前沒有同步 job，禁抓前就抓進來的作品還留在 ES，交給 job 拉掉（原圖與 artwork_main 不動）
INSERT INTO `artwork_forbidden_v2` (`site`, `author_id`, `artwork_id`, `source`, `created_at`, `updated_at`)
SELECT LOWER(TRIM(`site`)), TRIM(`author_id`), '', 'legacy', COALESCE(MIN(`insert_time`), NOW()), NOW()
FROM `artwork_forbidden`
GROUP BY LOWER(TRIM(`site`)), TRIM(`author_id`);

RENAME TABLE `artwork_forbidden` TO `artwork_forbidden_legacy`, `artwork_forbidden_v2` TO `artwork_forbidden`;

-- +migrate Down
RENAME TABLE `artwork_forbidden` TO `artwork_forbidden_v2`, `artwork_forbidden_legacy` TO `artwork_forbidden`;
DROP TABLE `artwork_forbidden_v2`;
