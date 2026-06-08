-- +migrate Up
ALTER TABLE `dmm_actresses`
    ADD COLUMN `name` varchar(255) NOT NULL DEFAULT '' COMMENT '女優姓名' AFTER `id`;

-- +migrate Down
ALTER TABLE `dmm_actresses`
    DROP COLUMN `name`;
