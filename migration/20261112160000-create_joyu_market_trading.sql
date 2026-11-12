-- +migrate Up
-- joyu.fyi 女優股市 P2：錢包、持股、成交紀錄、每日價格（規格：DevelopDocuments/opendata/joyu.fyi女優股市_2026-11-12.md）。
-- 金額一律用「分」（1 單位 = 100）存整數；使用者只有 Firebase uid（只限 Google 帳號開戶）

CREATE TABLE IF NOT EXISTS `joyu_wallets` (
  `firebase_uid` VARCHAR(128) NOT NULL,
  `cash` BIGINT NOT NULL COMMENT '現金（分）',
  `created_at` DATETIME NOT NULL COMMENT '開戶時間',
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`firebase_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `joyu_holdings` (
  `firebase_uid` VARCHAR(128) NOT NULL,
  `stock_id` INT UNSIGNED NOT NULL,
  `shares` BIGINT NOT NULL COMMENT '持有股數',
  `cost` BIGINT NOT NULL COMMENT '累計成本（分，含手續費），賣出時依比例扣掉',
  `today_bought` BIGINT NOT NULL DEFAULT 0 COMMENT 'today_date 那天買進的股數（T+1：隔天才能賣）',
  `today_date` DATE NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`firebase_uid`, `stock_id`),
  KEY `idx_stock` (`stock_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `joyu_trades` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `firebase_uid` VARCHAR(128) NOT NULL,
  `stock_id` INT UNSIGNED NOT NULL,
  `side` VARCHAR(4) NOT NULL COMMENT 'buy / sell',
  `shares` BIGINT NOT NULL,
  `amount` BIGINT NOT NULL COMMENT '成交金額（分，不含手續費）',
  `fee` BIGINT NOT NULL COMMENT '手續費（分），直接銷毀',
  `price_after` BIGINT NOT NULL COMMENT '成交後的股價（分）',
  `counterparty` VARCHAR(128) NOT NULL DEFAULT 'system' COMMENT '對手：system＝系統造市；之後開放撮合時記對方 uid',
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stock_created` (`stock_id`, `created_at`),
  KEY `idx_uid_created` (`firebase_uid`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `joyu_stock_daily` (
  `stock_id` INT UNSIGNED NOT NULL,
  `date` DATE NOT NULL COMMENT '台灣時間的日期，00:00 切日',
  `open` BIGINT NOT NULL,
  `high` BIGINT NOT NULL,
  `low` BIGINT NOT NULL,
  `close` BIGINT NOT NULL,
  `volume` BIGINT NOT NULL DEFAULT 0 COMMENT '成交股數',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`stock_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `joyu_stock_daily`;
DROP TABLE IF EXISTS `joyu_trades`;
DROP TABLE IF EXISTS `joyu_holdings`;
DROP TABLE IF EXISTS `joyu_wallets`;
