-- +migrate Up
ALTER TABLE `storyteller_users`
    ADD UNIQUE KEY `idx_storyteller_users_pen_name` (`pen_name`);

-- +migrate Down
ALTER TABLE `storyteller_users`
    DROP INDEX `idx_storyteller_users_pen_name`;
