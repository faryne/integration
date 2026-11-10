-- +migrate Up
ALTER TABLE `taipower_neighbor`
  ADD COLUMN `source_cityarea` VARCHAR(255) NULL
    COMMENT '台電來源行政區原文；舊資料不可還原時保持 NULL'
    AFTER `cityarea`;

-- +migrate Down
ALTER TABLE `taipower_neighbor`
  DROP COLUMN `source_cityarea`;
