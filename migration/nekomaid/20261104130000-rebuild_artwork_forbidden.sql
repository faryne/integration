-- 禁抓名單改版：MyISAM latin1 → InnoDB utf8mb4，加 id／soft delete／來源欄位，並支援「只禁單一作品」。
-- 舊資料的轉換規則（2026-11-04 使用者定案）：
--   有 author_id、沒有 artwork_id → 整個畫師（artwork_id = ''）
--   有 author_id、也有 artwork_id → 單一作品
--   沒有 author_id、只有 artwork_id → 單一作品，畫師從 artwork_main 反查，查不到就留空
--     （不能當成整個畫師：會變成 author_id = '' 的禁抓，把所有畫師 ID 空白的舊作品一起禁掉）
--   兩欄都空 → 沒有意義，略過
-- 同一目標的多列合併成一列。舊表改名成 artwork_forbidden_legacy 保留，Down 時換回去。

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
SELECT `site`, `author_id`, `artwork_id`, 'legacy', COALESCE(MIN(`insert_time`), NOW()), NOW()
FROM (
  SELECT LOWER(TRIM(f.`site`)) AS `site`,
         IF(TRIM(f.`author_id`) <> '', TRIM(f.`author_id`), COALESCE(m.`author_id`, '')) AS `author_id`,
         TRIM(f.`artwork_id`) AS `artwork_id`,
         f.`insert_time`
  FROM `artwork_forbidden` f
  -- artwork_main.artwork_id 是 unique，最多對到一列
  LEFT JOIN `artwork_main` m
    ON TRIM(f.`author_id`) = '' AND m.`site` = LOWER(TRIM(f.`site`)) AND m.`artwork_id` = TRIM(f.`artwork_id`)
  WHERE TRIM(f.`author_id`) <> '' OR TRIM(f.`artwork_id`) <> ''
) AS legacy
GROUP BY `site`, `author_id`, `artwork_id`;

RENAME TABLE `artwork_forbidden` TO `artwork_forbidden_legacy`, `artwork_forbidden_v2` TO `artwork_forbidden`;

-- +migrate Down
RENAME TABLE `artwork_forbidden` TO `artwork_forbidden_v2`, `artwork_forbidden_legacy` TO `artwork_forbidden`;
DROP TABLE `artwork_forbidden_v2`;
