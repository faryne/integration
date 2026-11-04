-- +migrate Up
-- 核准過的影片手動修改（只存被改的欄位，JSON）；DMM 同步寫 ES 前會把這些值蓋回去，手動修正不會被洗掉。
-- 另開一張表而不是在 dmm 加欄位：dmm 約 60 萬筆，MySQL 5.7 ADD COLUMN 會重建整張表
CREATE TABLE IF NOT EXISTS `dmm_video_overrides` (
    `vid` INT NOT NULL COMMENT '= dmm.id',
    `overrides` LONGTEXT NOT NULL COMMENT '手動修改覆寫的欄位（JSON）',
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`vid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `dmm_video_overrides`;
