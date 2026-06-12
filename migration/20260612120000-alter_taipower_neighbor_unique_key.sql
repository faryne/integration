-- +migrate Up
ALTER TABLE `taipower_neighbor`
  DROP INDEX `obj_month_id`;

-- +migrate Down
ALTER TABLE `taipower_neighbor`
  ADD UNIQUE KEY `obj_month_id` (`obj_month_id`,`obj_year`,`obj_month`);
