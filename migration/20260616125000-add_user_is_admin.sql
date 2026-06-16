-- +migrate Up
ALTER TABLE `users`
    ADD COLUMN `is_admin` TINYINT(1) NOT NULL DEFAULT 0 AFTER `disabled`;

-- +migrate Down
ALTER TABLE `users`
    DROP COLUMN `is_admin`;
