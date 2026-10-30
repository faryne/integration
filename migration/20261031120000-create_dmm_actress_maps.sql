-- +migrate Up
-- DMM 女優 ID → 女優（xcity／manual）對照表：影片來自 DMM、女優資料來自 xcity，兩邊沒有共同的 key。
-- 只收有同名問題的女優，手動用 SQL 維護；一個 DMM ID 只對到一位，一位女優可以有多個 DMM ID
CREATE TABLE IF NOT EXISTS `dmm_actress_maps` (
    `dmm_id` VARCHAR(20) NOT NULL COMMENT 'DMM 女優 ID',
    `domain` VARCHAR(32) NOT NULL COMMENT '對到的女優 domain：xcity / manual',
    `aid` INT NOT NULL COMMENT '對到的女優在該 domain 的 id（dmm_actresses.id）',
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`dmm_id`),
    KEY `dmm_actress_maps_domain_aid` (`domain`, `aid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +migrate Down
DROP TABLE IF EXISTS `dmm_actress_maps`;
