-- +migrate Up
-- 女優主題的自訂主題（特輯、身材）：管理員用條件組合，每週排程依這裡的定義產生主題 JSON
-- slug 只在未刪除的主題間不重複（程式檢查），刪除後可以重用，所以不建 unique index
CREATE TABLE IF NOT EXISTS `av_actress_topics` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(64) NOT NULL COMMENT '網址 /av/actress/topics/{slug}',
    `title` VARCHAR(100) NOT NULL,
    `group_key` VARCHAR(16) NOT NULL COMMENT 'special（特輯）／body（身材）',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '總覽頁同分組內的順序，小的在前',
    `default_sort` VARCHAR(16) NOT NULL DEFAULT 'videos' COMMENT 'videos／recent／genre／debut',
    `conditions` LONGTEXT NOT NULL COMMENT '條件 JSON（ActressTopicConditions）',
    `is_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '停用後下一次排程從 index.json 拿掉',
    `last_count` INT NULL DEFAULT NULL COMMENT '上次排程產生時符合的人數；NULL＝尚未產生',
    `last_generated_at` TIMESTAMP NULL DEFAULT NULL,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
    `updated_by` BIGINT UNSIGNED NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `av_actress_topics_slug` (`slug`),
    KEY `av_actress_topics_list` (`is_deleted`, `group_key`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 第一批身材主題（原本寫在程式裡，門檻是 2026-10-31 用 prod 資料試算後抓的）
INSERT INTO `av_actress_topics` (`slug`, `title`, `group_key`, `sort_order`, `default_sort`, `conditions`, `created_at`, `updated_at`) VALUES
    ('petite', '嬌小', 'body', 1, 'videos', '{"height":[0,150]}', NOW(), NOW()),
    ('tall', '高挑', 'body', 2, 'videos', '{"height":[168,0]}', NOW(), NOW()),
    ('small-breasts', '微乳', 'body', 3, 'videos', '{"cup":["A","B"]}', NOW(), NOW()),
    ('shapely-breasts', '美乳', 'body', 4, 'videos', '{"cup":["C","D"],"waist":[0,58]}', NOW(), NOW()),
    ('big-breasts', '巨乳', 'body', 5, 'videos', '{"cup":["E","G"]}', NOW(), NOW()),
    ('huge-breasts', '爆乳', 'body', 6, 'videos', '{"cup":["H","I"]}', NOW(), NOW()),
    ('giant-breasts', '超乳', 'body', 7, 'videos', '{"cup":["J",""]}', NOW(), NOW()),
    ('marshmallow', '棉花糖', 'body', 8, 'videos', '{"cup":["F",""],"hips":[90,0]}', NOW(), NOW()),
    ('petite-busty', '嬌小巨乳', 'body', 9, 'videos', '{"height":[0,152],"cup":["F",""]}', NOW(), NOW()),
    ('model-figure', '模特兒身材', 'body', 10, 'videos', '{"height":[165,0],"waist":[0,58]}', NOW(), NOW()),
    ('peach-hips', '蜜桃臀', 'body', 11, 'videos', '{"waist":[0,60],"hips":[92,0]}', NOW(), NOW()),
    ('slim-waist', '細腰', 'body', 12, 'videos', '{"hip_waist_diff":[32,0]}', NOW(), NOW());

-- +migrate Down
DROP TABLE IF EXISTS `av_actress_topics`;
