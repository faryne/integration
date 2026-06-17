-- +migrate Up
CREATE TABLE `eroge_video_title_keywords` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `keyword` VARCHAR(255) NOT NULL,
    `enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_eroge_video_title_keywords_keyword` (`keyword`),
    KEY `idx_eroge_video_title_keywords_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `eroge_video_title_keywords` (`keyword`, `enabled`) VALUES
    ('PV', 1),
    ('OP', 1),
    ('OPムービー', 1),
    ('オープニング', 1),
    ('オープニングムービー', 1),
    ('プロモーション', 1),
    ('プロモーションムービー', 1),
    ('ティザー', 1),
    ('体験版', 1),
    ('デモムービー', 1),
    ('発売記念', 1),
    ('エンディング', 1),
    ('ＯＰムービー', 1),
    ('demo movie', 1)
ON DUPLICATE KEY UPDATE `enabled` = VALUES(`enabled`);

-- +migrate Down
DROP TABLE IF EXISTS `eroge_video_title_keywords`;
