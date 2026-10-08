-- +migrate Up
-- 追蹤者用哪個身份追蹤（0 = 帳號本人）。以筆名回追時記筆名，避免把筆名串回本人帳號。
ALTER TABLE `storyteller_author_favorites`
    ADD COLUMN `follower_profile_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 = account identity (self)' AFTER `user_id`,
    DROP INDEX `idx_storyteller_author_favorites_user_author_profile`,
    ADD UNIQUE KEY `idx_storyteller_author_favorites_follower_author` (`user_id`, `follower_profile_id`, `author_user_id`, `author_profile_id`),
    ADD KEY `idx_storyteller_author_favorites_follower_profile` (`follower_profile_id`);

-- +migrate Down
DELETE FROM `storyteller_author_favorites` WHERE `follower_profile_id` != 0;
ALTER TABLE `storyteller_author_favorites`
    DROP INDEX `idx_storyteller_author_favorites_follower_profile`,
    DROP INDEX `idx_storyteller_author_favorites_follower_author`,
    ADD UNIQUE KEY `idx_storyteller_author_favorites_user_author_profile` (`user_id`, `author_user_id`, `author_profile_id`),
    DROP COLUMN `follower_profile_id`;
