-- +migrate Up
ALTER TABLE `taipower_neighbor`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- +migrate Down
ALTER TABLE `taipower_neighbor`
  CONVERT TO CHARACTER SET utf8mb3
  COLLATE utf8mb3_general_ci;
