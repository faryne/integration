-- 收藏表轉 utf8mb4；author_id 從 varchar(10) 放寬到 varchar(15)，跟 artwork_main 對齊（pixiv 畫師 ID 已到 9 位數）。

-- +migrate Up
ALTER TABLE `users_fav_authors` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `users_fav_authors` MODIFY `author_id` varchar(15) NOT NULL;
ALTER TABLE `users_fav_artworks` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `users_fav_artworks` MODIFY `author_id` varchar(15) NOT NULL;
ALTER TABLE `users_fav_tags` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- +migrate Down
-- 長度與編碼不還原：縮回 varchar(10)／utf8 可能截斷資料
SELECT 1;
