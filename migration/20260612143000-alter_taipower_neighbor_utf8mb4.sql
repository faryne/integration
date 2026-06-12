-- +migrate Up
ALTER TABLE `taipower_neighbor`
  DROP INDEX `uniq_cityarea_unit_summary`,
  ADD COLUMN `uniq_hash` binary(32)
    GENERATED ALWAYS AS (
      UNHEX(SHA2(CONCAT_WS(CHAR(31), `cityarea`, `unit`, `summary`), 256))
    ) STORED,
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci,
  ADD UNIQUE KEY `uniq_cityarea_unit_summary` (`uniq_hash`);

-- +migrate Down
ALTER TABLE `taipower_neighbor`
  DROP INDEX `uniq_cityarea_unit_summary`,
  DROP COLUMN `uniq_hash`,
  CONVERT TO CHARACTER SET utf8mb3
  COLLATE utf8mb3_general_ci,
  ADD UNIQUE KEY `uniq_cityarea_unit_summary` (`cityarea`,`unit`,`summary`(191));
