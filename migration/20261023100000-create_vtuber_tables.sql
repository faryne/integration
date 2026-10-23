-- +migrate Up
-- VTuber 直播行事曆（DevelopDocuments/opendata/vtuber直播行事曆_2026-10-23.md）。
-- 舊的 vtuber_lives／vtuber_stats 是 PHP 時代建的，2022-04 之後就沒資料；結構不合用，改名成 *_legacy 保留、不遷移。
-- 先照抄 prod schema（2026-10-23 SHOW CREATE TABLE）建空表：prod 上是 no-op，本機才有表可以 RENAME（MySQL 5.7 沒有 RENAME TABLE IF EXISTS）。
CREATE TABLE IF NOT EXISTS `vtuber_lives` (
    `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
    `channel_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '頻道ID',
    `video_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '影片ID',
    `live_chat_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '聊天室ID',
    `published_at` datetime NOT NULL COMMENT '發布時間',
    `started_at` datetime NOT NULL COMMENT '直播開始時間',
    `actual_started_at` datetime DEFAULT NULL,
    `actual_ended_at` datetime DEFAULT NULL,
    `info` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '其他額外資訊',
    `created_at` timestamp NULL DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `vtuber_lives_channel_id_video_id_live_chat_id_unique` (`channel_id`,`video_id`,`live_chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vtuber_stats` (
    `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
    `channel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '頻道 ID',
    `subscriberCount` int(11) NOT NULL COMMENT '訂閱數',
    `videoCount` int(11) NOT NULL COMMENT '影片數目',
    `viewCount` bigint(20) NOT NULL COMMENT '總觀看次數',
    `record_dt` datetime NOT NULL COMMENT '記錄日期時間',
    `created_at` timestamp NULL DEFAULT NULL,
    `updated_at` timestamp NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `vtuber_stats_channel_id_record_dt_unique` (`channel_id`,`record_dt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

RENAME TABLE `vtuber_lives` TO `vtuber_lives_legacy`, `vtuber_stats` TO `vtuber_stats_legacy`;

-- 頻道名冊：週更 job 從官網爬，每日統計 job 更新頻道資訊與最新數字
CREATE TABLE `vtuber_channels` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `channel_id` VARCHAR(32) NOT NULL COMMENT 'YouTube channel ID (UC...)',
    `talent_slug` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '官網藝人頁 /talents/<slug>/',
    `sort_order` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '官網列表頁順序',
    `unit_slug` VARCHAR(32) NULL DEFAULT NULL COMMENT '官網分組 /talents?gp=<slug>，例如 gen-3、myth',
    `title` VARCHAR(255) NOT NULL DEFAULT '',
    `custom_url` VARCHAR(100) NULL DEFAULT NULL COMMENT '@handle，藝人頁網址用',
    `description` TEXT NULL,
    `thumbnail_url` VARCHAR(255) NOT NULL DEFAULT '',
    `banner_url` VARCHAR(255) NOT NULL DEFAULT '',
    `trailer_video_id` VARCHAR(16) NULL DEFAULT NULL,
    `channel_published_at` DATETIME NULL DEFAULT NULL,
    `subscriber_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `view_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `video_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `calendar_id` VARCHAR(255) NULL DEFAULT NULL COMMENT '個人 Google 行事曆 ID；舊行事曆用 -cmd vtuber-import-calendars 匯入，沒有的由同步 job 建立',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = 已不在官網名冊上',
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_vtuber_channels_channel_id` (`channel_id`),
    UNIQUE KEY `uq_vtuber_channels_custom_url` (`custom_url`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 直播（含首播）：只收有 liveStreamingDetails 的影片
CREATE TABLE `vtuber_lives` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `video_id` VARCHAR(16) NOT NULL,
    `channel_id` VARCHAR(32) NOT NULL,
    `title` VARCHAR(255) NOT NULL DEFAULT '',
    `status` VARCHAR(10) NOT NULL COMMENT 'upcoming / live / ended / cancelled',
    `scheduled_start_at` DATETIME NULL DEFAULT NULL,
    `actual_start_at` DATETIME NULL DEFAULT NULL,
    `actual_end_at` DATETIME NULL DEFAULT NULL,
    `concurrent_viewers` INT UNSIGNED NULL DEFAULT NULL COMMENT '最後一次看到的同接人數，只在 live 時有值',
    `thumbnail_url` VARCHAR(255) NOT NULL DEFAULT '',
    `checked_at` DATETIME NOT NULL COMMENT '最後一次向 YouTube 確認的時間',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_vtuber_lives_video_id` (`video_id`),
    KEY `idx_vtuber_lives_channel_start` (`channel_id`, `scheduled_start_at`),
    KEY `idx_vtuber_lives_status_start` (`status`, `scheduled_start_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 每日頻道統計，record_date 是 Asia/Taipei 日期
CREATE TABLE `vtuber_stats` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `channel_id` VARCHAR(32) NOT NULL,
    `record_date` DATE NOT NULL,
    `subscriber_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `view_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `video_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_vtuber_stats_channel_date` (`channel_id`, `record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
-- 新表的資料都能從 YouTube 重新收集，rollback 直接 DROP；舊表改回原名。
-- calendar_id 會跟著 vtuber_channels 一起刪掉，重新 up 後再跑一次 -cmd vtuber-import-calendars
DROP TABLE IF EXISTS `vtuber_stats`;
DROP TABLE IF EXISTS `vtuber_lives`;
DROP TABLE IF EXISTS `vtuber_channels`;
RENAME TABLE `vtuber_lives_legacy` TO `vtuber_lives`, `vtuber_stats_legacy` TO `vtuber_stats`;
