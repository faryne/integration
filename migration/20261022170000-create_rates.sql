-- +migrate Up
-- 匯率表在 PHP 時代就建好了，repo 裡一直沒有 migration，本機／新環境才補得出來。
-- schema 照抄 prod（2026-10-22 SHOW CREATE TABLE）；prod 已存在，IF NOT EXISTS 讓它在 prod 上是 no-op。
-- 注意：實際資料是 base＝外幣、to＝TWD，跟欄位註解寫的方向相反，以資料為準（註解保留 prod 原樣）。
CREATE TABLE IF NOT EXISTS `rates` (
    `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
    `service_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '_' COMMENT '匯率提供者名稱',
    `base` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TWD' COMMENT '作為計算基礎的貨幣名稱，預設為新台幣 TWD',
    `to` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USD' COMMENT '目標貨幣名稱',
    `buy_rate` decimal(8,5) NOT NULL COMMENT '銀行買入匯率',
    `sell_rate` decimal(8,5) NOT NULL COMMENT '銀行賣出匯率',
    `record_date` date NOT NULL COMMENT '記錄日期',
    `created_at` timestamp NULL DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `rates_service_name_record_date_base_to_unique` (`service_name`,`record_date`,`base`,`to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
-- 刻意不 DROP：prod 上這張表有 PHP 時代累積的歷史匯率，rollback 不該連資料一起刪掉
SELECT 1;
