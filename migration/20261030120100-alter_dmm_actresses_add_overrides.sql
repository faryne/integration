-- +migrate Up
-- 核准過的手動修改（只存被改的欄位，JSON）；xcity 同步寫入前會把這些值蓋回去，手動修正不會被洗掉
ALTER TABLE `dmm_actresses`
    ADD COLUMN `overrides` LONGTEXT NULL COMMENT '手動修改覆寫的欄位（JSON）' AFTER `info`;

-- +migrate Down
ALTER TABLE `dmm_actresses`
    DROP COLUMN `overrides`;
