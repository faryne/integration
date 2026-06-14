-- +migrate Up
UPDATE `taipower_neighbor`
SET `obj_year` = `obj_year` + 1911
WHERE `obj_year` > 0
  AND `obj_year` < 1911;

-- +migrate Down
-- This data correction is intentionally irreversible because Gregorian years
-- cannot be distinguished from pre-existing Gregorian data after migration.
