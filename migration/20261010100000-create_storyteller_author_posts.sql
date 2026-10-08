-- +migrate Up
-- 作者動態（類 X 的短貼文）：每個身份（本人或筆名）各自一條時間軸
CREATE TABLE `storyteller_author_posts` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Owner account, storyteller_users.id; never exposed',
    `profile_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Posting identity; 0 = account identity (self)',
    `body` TEXT NOT NULL COMMENT 'Plain text with [spoiler]/[r18] markers, max 1000 chars',
    `pinned_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'At most one pinned post per identity',
    `attach_project_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Attached work card; 0 = none',
    `attach_story_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Attached episode; 0 = whole project',
    `notified_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Processed by the follower notification scan',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_author_posts_public_id` (`public_id`),
    KEY `idx_storyteller_author_posts_timeline` (`user_id`, `profile_id`, `is_deleted`, `id`),
    KEY `idx_storyteller_author_posts_notify_scan` (`notified_at`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通用留言表：v1 只掛在作者動態上（target_type = author_post），之後的討論區沿用
CREATE TABLE `storyteller_comments` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL,
    `target_type` VARCHAR(32) NOT NULL COMMENT 'author_post',
    `target_id` BIGINT UNSIGNED NOT NULL,
    `parent_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 = top-level; replies hang under a top-level comment only',
    `reply_to_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Reply being answered inside the thread; 0 = the thread itself',
    `user_id` BIGINT UNSIGNED NOT NULL,
    `profile_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Commenting identity; 0 = account identity (self)',
    `body` TEXT NOT NULL COMMENT 'Plain text with [spoiler]/[r18] markers, max 500 chars',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_comments_public_id` (`public_id`),
    KEY `idx_storyteller_comments_target` (`target_type`, `target_id`, `id`),
    KEY `idx_storyteller_comments_identity` (`user_id`, `profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 作者封鎖名單：以「封鎖者身份」為單位，避免被封鎖者從另一個身份推出筆名關係
CREATE TABLE `storyteller_author_blocks` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Blocker account',
    `profile_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Blocker identity; 0 = account identity (self)',
    `blocked_user_id` BIGINT UNSIGNED NOT NULL COMMENT 'Blocked account regardless of the identity it uses',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_storyteller_author_blocks_public_id` (`public_id`),
    UNIQUE KEY `uq_storyteller_author_blocks_pair` (`user_id`, `profile_id`, `blocked_user_id`),
    KEY `idx_storyteller_author_blocks_blocked` (`blocked_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 按讚只記帳號、不記身份，也不公開名單；取消讚直接刪列
CREATE TABLE `storyteller_author_post_likes` (
    `post_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`post_id`, `user_id`),
    KEY `idx_storyteller_author_post_likes_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_author_post_likes`;
DROP TABLE `storyteller_author_blocks`;
DROP TABLE `storyteller_comments`;
DROP TABLE `storyteller_author_posts`;
