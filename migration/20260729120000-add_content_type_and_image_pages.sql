
-- +migrate Up
ALTER TABLE `storyteller_stories`
    ADD COLUMN `content_type` VARCHAR(16) NOT NULL DEFAULT 'text'
        COMMENT 'text=文字故事，image=圖像作品（latest_content 存頁面 JSON，storyteller_story_versions.content 比照）' AFTER `is_volume`;

-- +migrate Down
ALTER TABLE `storyteller_stories`
    DROP COLUMN `content_type`;
