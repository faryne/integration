-- +migrate Up
-- 帳號與額外筆名補上 public_id：管理後台等需要指向「某個帳號／筆名」的地方一律用它，不再對外帶內部流水號。
-- 格式跟其他表的 public_id 一致（16 碼 hex）；既有資料以 MD5 亂數回填，新資料由 repository 寫入時產生。
ALTER TABLE `storyteller_users`
    ADD COLUMN `public_id` VARCHAR(32) NULL DEFAULT NULL AFTER `id`;
UPDATE `storyteller_users` SET `public_id` = LEFT(MD5(CONCAT(`id`, '-', UUID(), '-', RAND())), 16) WHERE `public_id` IS NULL;
ALTER TABLE `storyteller_users`
    MODIFY COLUMN `public_id` VARCHAR(32) NOT NULL,
    ADD UNIQUE KEY `uq_storyteller_users_public_id` (`public_id`);

ALTER TABLE `storyteller_author_profiles`
    ADD COLUMN `public_id` VARCHAR(32) NULL DEFAULT NULL AFTER `id`;
UPDATE `storyteller_author_profiles` SET `public_id` = LEFT(MD5(CONCAT(`id`, '-', UUID(), '-', RAND())), 16) WHERE `public_id` IS NULL;
ALTER TABLE `storyteller_author_profiles`
    MODIFY COLUMN `public_id` VARCHAR(32) NOT NULL,
    ADD UNIQUE KEY `uq_storyteller_author_profiles_public_id` (`public_id`);

-- +migrate Down
ALTER TABLE `storyteller_author_profiles` DROP KEY `uq_storyteller_author_profiles_public_id`, DROP COLUMN `public_id`;
ALTER TABLE `storyteller_users` DROP KEY `uq_storyteller_users_public_id`, DROP COLUMN `public_id`;
