-- +migrate Up
SET @drop_submitter_fk := (
    SELECT IF(
        COUNT(*) > 0,
        'ALTER TABLE `eroge_brands` DROP FOREIGN KEY `fk_eroge_brands_submitted_by_user`',
        'SELECT 1'
    )
    FROM `information_schema`.`TABLE_CONSTRAINTS`
    WHERE `CONSTRAINT_SCHEMA` = DATABASE()
        AND `TABLE_NAME` = 'eroge_brands'
        AND `CONSTRAINT_NAME` = 'fk_eroge_brands_submitted_by_user'
        AND `CONSTRAINT_TYPE` = 'FOREIGN KEY'
);
PREPARE drop_submitter_fk_stmt FROM @drop_submitter_fk;
EXECUTE drop_submitter_fk_stmt;
DEALLOCATE PREPARE drop_submitter_fk_stmt;

UPDATE `eroge_brands`
SET `submitted_by_user_id` = 0
WHERE `submitted_by_user_id` IS NULL;

ALTER TABLE `eroge_brands`
    MODIFY COLUMN `submitted_by_user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0;

-- +migrate Down
ALTER TABLE `eroge_brands`
    MODIFY COLUMN `submitted_by_user_id` BIGINT UNSIGNED NULL;

SET @add_submitter_fk := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `eroge_brands` ADD CONSTRAINT `fk_eroge_brands_submitted_by_user` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL',
        'SELECT 1'
    )
    FROM `information_schema`.`TABLE_CONSTRAINTS`
    WHERE `CONSTRAINT_SCHEMA` = DATABASE()
        AND `TABLE_NAME` = 'eroge_brands'
        AND `CONSTRAINT_NAME` = 'fk_eroge_brands_submitted_by_user'
        AND `CONSTRAINT_TYPE` = 'FOREIGN KEY'
);
PREPARE add_submitter_fk_stmt FROM @add_submitter_fk;
EXECUTE add_submitter_fk_stmt;
DEALLOCATE PREPARE add_submitter_fk_stmt;
