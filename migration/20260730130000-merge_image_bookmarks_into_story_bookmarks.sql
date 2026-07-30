-- +migrate Up
-- 圖片書籤改成共用 storyteller_story_bookmarks，不再另外開一張表：
-- line_index（INT，只能存文字行號）改成通用的 line_id（VARCHAR），文字書籤存行號字串，
-- 圖片書籤存頁面 id；story_version_id 改成可為 NULL——圖片頁面 id 不隨版本變動，
-- 不需要（也不該）像文字行號那樣綁定特定版本才能判斷是否過期。
--
-- 刻意拆成多條獨立的 ALTER TABLE，不要在同一條語句裡「DROP KEY 再 ADD 同名 KEY」——
-- 同一條 ALTER 裡混著欄位型別變更（會觸發 ALGORITHM=COPY）跟同名索引重建，MySQL/InnoDB
-- 對這個組合有已知問題，會在明明沒有真的重複資料的情況下噴 Error 1022（重建用的暫存表
-- 判斷索引衝突判斷錯誤）；拆開成多條語句，每條都完整落地後再做下一步，就不會踩到。
DROP TABLE IF EXISTS `storyteller_story_image_bookmarks`;

ALTER TABLE `storyteller_story_bookmarks`
    DROP FOREIGN KEY `fk_storyteller_story_bookmarks_version`;

ALTER TABLE `storyteller_story_bookmarks`
    DROP KEY `idx_storyteller_story_bookmarks_unique`;

ALTER TABLE `storyteller_story_bookmarks`
    MODIFY COLUMN `story_version_id` BIGINT UNSIGNED NULL COMMENT '書籤當下對應的故事版本；圖片頁面書籤不綁版本，此欄為 NULL';

ALTER TABLE `storyteller_story_bookmarks`
    CHANGE COLUMN `line_index` `line_id` VARCHAR(64) NOT NULL COMMENT '文字書籤存行號（字串形式，0-based）；圖片書籤存頁面 id';

ALTER TABLE `storyteller_story_bookmarks`
    ADD UNIQUE KEY `idx_storyteller_story_bookmarks_unique` (`user_id`, `story_id`, `story_version_id`, `line_id`);

ALTER TABLE `storyteller_story_bookmarks`
    ADD CONSTRAINT `fk_storyteller_story_bookmarks_version`
        FOREIGN KEY (`story_version_id`) REFERENCES `storyteller_story_versions` (`id`) ON DELETE CASCADE;

-- +migrate Down
CREATE TABLE `storyteller_story_image_bookmarks` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '加入書籤的使用者',
    `story_id` BIGINT UNSIGNED NOT NULL COMMENT '所屬的話（content_type=image 的故事）',
    `page_id` VARCHAR(64) NOT NULL COMMENT '書籤指向的頁面 id',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_story_image_bookmarks_unique` (`user_id`, `story_id`, `page_id`),
    KEY `idx_storyteller_story_image_bookmarks_story` (`story_id`),
    CONSTRAINT `fk_storyteller_story_image_bookmarks_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_story_image_bookmarks_story`
        FOREIGN KEY (`story_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `storyteller_story_bookmarks`
    DROP FOREIGN KEY `fk_storyteller_story_bookmarks_version`;

ALTER TABLE `storyteller_story_bookmarks`
    DROP KEY `idx_storyteller_story_bookmarks_unique`;

ALTER TABLE `storyteller_story_bookmarks`
    CHANGE COLUMN `line_id` `line_index` INT UNSIGNED NOT NULL COMMENT '該版本內容中的行號（0-based）';

ALTER TABLE `storyteller_story_bookmarks`
    MODIFY COLUMN `story_version_id` BIGINT UNSIGNED NOT NULL COMMENT '書籤當下對應的故事版本';

ALTER TABLE `storyteller_story_bookmarks`
    ADD UNIQUE KEY `idx_storyteller_story_bookmarks_unique` (`user_id`, `story_version_id`, `line_index`);

ALTER TABLE `storyteller_story_bookmarks`
    ADD CONSTRAINT `fk_storyteller_story_bookmarks_version`
        FOREIGN KEY (`story_version_id`) REFERENCES `storyteller_story_versions` (`id`) ON DELETE CASCADE;
