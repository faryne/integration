-- +migrate Up
ALTER TABLE `taipower_neighbor`
  ADD COLUMN `duplicate_hash` CHAR(64)
    CHARACTER SET ascii
    COLLATE ascii_bin
    NULL
    COMMENT 'obj_year/obj_month/cityarea/unit/summary/cash SHA-256'
    AFTER `obj_month`;

UPDATE `taipower_neighbor`
SET `duplicate_hash` = SHA2(
  CONCAT_WS(
    CHAR(31),
    `obj_year`,
    `obj_month`,
    `cityarea`,
    `unit`,
    `summary`,
    REPLACE(FORMAT(`cash`, 6), ',', '')
  ),
  256
);

UPDATE `taipower_neighbor` AS duplicate
INNER JOIN (
  SELECT grouped.`duplicate_hash`, grouped.`first_id`
  FROM (
    SELECT `duplicate_hash`, MIN(`id`) AS `first_id`
    FROM `taipower_neighbor`
    GROUP BY `duplicate_hash`
    HAVING COUNT(*) > 1
  ) AS grouped
) AS duplicated
  ON duplicated.`duplicate_hash` = duplicate.`duplicate_hash`
  AND duplicate.`id` <> duplicated.`first_id`
SET duplicate.`duplicate_hash` = SHA2(
  CONCAT(duplicate.`duplicate_hash`, ':legacy:', duplicate.`id`),
  256
);

ALTER TABLE `taipower_neighbor`
  MODIFY COLUMN `duplicate_hash` CHAR(64)
    CHARACTER SET ascii
    COLLATE ascii_bin
    NOT NULL
    COMMENT 'obj_year/obj_month/cityarea/unit/summary/cash SHA-256',
  ADD UNIQUE KEY `uniq_duplicate_hash` (`duplicate_hash`);

-- +migrate Down
ALTER TABLE `taipower_neighbor`
  DROP INDEX `uniq_duplicate_hash`,
  DROP COLUMN `duplicate_hash`;
