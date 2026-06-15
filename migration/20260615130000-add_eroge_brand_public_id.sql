-- +migrate Up
ALTER TABLE `eroge_brands`
    ADD COLUMN `public_id` CHAR(32) NULL AFTER `id`;

UPDATE `eroge_brands`
SET `public_id` = LEFT(LOWER(SHA2(CONCAT(UUID(), ':', `id`), 256)), 32);

ALTER TABLE `eroge_brands`
    MODIFY COLUMN `public_id` CHAR(32) NOT NULL,
    ADD UNIQUE KEY `idx_eroge_brands_public_id` (`public_id`);

-- +migrate Down
ALTER TABLE `eroge_brands`
    DROP INDEX `idx_eroge_brands_public_id`,
    DROP COLUMN `public_id`;
