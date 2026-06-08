-- +migrate Up
ALTER TABLE `dmm_actresses`
    ADD COLUMN `domain` varchar(32) NOT NULL DEFAULT 'dmm' COMMENT '資料來源 domain: dmm / xcity' AFTER `id`;

ALTER TABLE `dmm_actresses`
    DROP PRIMARY KEY,
    DROP INDEX `dmm_actresses_id_unique`,
    ADD PRIMARY KEY (`domain`, `id`),
    ADD UNIQUE KEY `dmm_actresses_domain_id_unique` (`domain`, `id`);

-- +migrate Down
ALTER TABLE `dmm_actresses`
    DROP PRIMARY KEY,
    DROP INDEX `dmm_actresses_domain_id_unique`,
    ADD PRIMARY KEY (`id`),
    ADD UNIQUE KEY `dmm_actresses_id_unique` (`id`);

ALTER TABLE `dmm_actresses`
    DROP COLUMN `domain`;
