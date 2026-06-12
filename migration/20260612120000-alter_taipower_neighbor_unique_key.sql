-- +migrate Up
ALTER TABLE `taipower_neighbor`
  DROP INDEX `obj_month_id`,
  ADD UNIQUE KEY `uniq_cityarea_unit_summary` (`cityarea`,`unit`,`summary`(191));

-- +migrate Down
ALTER TABLE `taipower_neighbor`
  DROP INDEX `uniq_cityarea_unit_summary`,
  ADD UNIQUE KEY `obj_month_id` (`obj_month_id`,`obj_year`,`obj_month`);
