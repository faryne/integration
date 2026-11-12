-- +migrate Up
-- joyu.fyi 女優股市：上市的女優（規格：DevelopDocuments/opendata/joyu.fyi女優股市_2026-11-12.md）。
-- 代碼 J0001… 由 id 推出來，不另外存；金額一律用「分」（1 單位 = 100）存整數
CREATE TABLE IF NOT EXISTS `joyu_stocks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `domain` VARCHAR(16) NOT NULL COMMENT 'dmm_actresses.domain（xcity／manual）',
  `aid` INT NOT NULL COMMENT 'dmm_actresses.id',
  `name` VARCHAR(128) NOT NULL COMMENT '上市審核時的名字快照，識別一律看 domain＋aid',
  `status` VARCHAR(16) NOT NULL DEFAULT 'listed' COMMENT 'listed 上市中 / delisted 已下市',
  `fundamental` DECIMAL(12,4) NOT NULL DEFAULT 10 COMMENT '基本面 F（單位，不是分）',
  `shares_out` BIGINT NOT NULL DEFAULT 0 COMMENT '使用者持有的總股數 S',
  `last_price` BIGINT NOT NULL COMMENT '現價（分）',
  `prev_close` BIGINT NOT NULL COMMENT '昨收（分），漲跌幅與漲跌停的基準',
  `videos_90d` INT NOT NULL DEFAULT 0 COMMENT '近 90 天配信部數（不含總集編）',
  `listed_at` DATETIME NOT NULL,
  `delisted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_actress` (`domain`, `aid`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `joyu_stocks`;
