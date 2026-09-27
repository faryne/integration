-- +migrate Up
-- 以 JSON array 字串保存少量自由標籤；TEXT 可相容 MySQL 5.7，格式由 service 驗證。
ALTER TABLE `storyteller_assistant_memories`
    ADD COLUMN `tags` TEXT NULL AFTER `kind`,
    MODIFY COLUMN `scope_type` VARCHAR(16) NOT NULL COMMENT 'project, story, lore';

-- +migrate Down
ALTER TABLE `storyteller_assistant_memories`
    DROP COLUMN `tags`,
    MODIFY COLUMN `scope_type` VARCHAR(16) NOT NULL COMMENT 'account, project, story, lore';
