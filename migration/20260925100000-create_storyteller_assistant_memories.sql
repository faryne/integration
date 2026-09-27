-- +migrate Up
-- 記憶屬於梭梭本身，不綁定使用者選擇的 Skill，避免切換 Skill 後人格與長期偏好失憶。
-- scope_type 與目標欄位的組合由應用層保證；MySQL 5.7 不強制 CHECK：
-- account 三個目標皆為 NULL；project / story / lore 僅對應的目標 ID 有值。
CREATE TABLE `storyteller_assistant_memories` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `public_id` VARCHAR(32) NOT NULL COMMENT 'Random identifier of this memory, unrelated to its scope target',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'storyteller_users.id, no FK per user-decoupling convention',
    `scope_type` VARCHAR(16) NOT NULL COMMENT 'account, project, story, lore',
    `project_id` BIGINT UNSIGNED NULL COMMENT 'Target project when scope_type is project',
    `story_id` BIGINT UNSIGNED NULL COMMENT 'Target story when scope_type is story',
    `lore_id` BIGINT UNSIGNED NULL COMMENT 'Target lore when scope_type is lore',
    `kind` VARCHAR(32) NOT NULL COMMENT 'preference, instruction, decision, context',
    `content` TEXT NOT NULL COMMENT 'One concise, independently retrievable memory',
    `priority` TINYINT UNSIGNED NOT NULL DEFAULT 50 COMMENT 'Retrieval priority from 0 to 100; validated by the service',
    `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Pinned memories cannot be automatically superseded or forgotten',
    `superseded_by_id` BIGINT UNSIGNED NULL COMMENT 'Newer memory replacing this record; NULL means current',
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `deleted_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_assistant_memories_public_id` (`public_id`),
    KEY `idx_storyteller_assistant_memories_account` (`user_id`, `scope_type`, `is_deleted`, `superseded_by_id`, `is_pinned`, `priority`, `updated_at`),
    KEY `idx_storyteller_assistant_memories_project` (`project_id`, `user_id`, `is_deleted`, `superseded_by_id`, `is_pinned`, `priority`, `updated_at`),
    KEY `idx_storyteller_assistant_memories_story` (`story_id`, `user_id`, `is_deleted`, `superseded_by_id`, `is_pinned`, `priority`, `updated_at`),
    KEY `idx_storyteller_assistant_memories_lore` (`lore_id`, `user_id`, `is_deleted`, `superseded_by_id`, `is_pinned`, `priority`, `updated_at`),
    KEY `idx_storyteller_assistant_memories_superseded_by` (`superseded_by_id`),
    CONSTRAINT `fk_storyteller_assistant_memories_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_assistant_memories_story`
        FOREIGN KEY (`story_id`) REFERENCES `storyteller_stories` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_assistant_memories_lore`
        FOREIGN KEY (`lore_id`) REFERENCES `storyteller_lores` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_assistant_memories_superseded_by`
        FOREIGN KEY (`superseded_by_id`) REFERENCES `storyteller_assistant_memories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 一筆記憶可以由多則對話共同佐證；訊息被清除時只移除來源關聯，不連帶遺忘已整理出的記憶。
CREATE TABLE `storyteller_assistant_memory_sources` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `memory_id` BIGINT UNSIGNED NOT NULL,
    `message_id` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_assistant_memory_sources_pair` (`memory_id`, `message_id`),
    KEY `idx_storyteller_assistant_memory_sources_message` (`message_id`),
    CONSTRAINT `fk_storyteller_assistant_memory_sources_memory`
        FOREIGN KEY (`memory_id`) REFERENCES `storyteller_assistant_memories` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_assistant_memory_sources_message`
        FOREIGN KEY (`message_id`) REFERENCES `storyteller_story_chat_messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +migrate Down
DROP TABLE `storyteller_assistant_memory_sources`;
DROP TABLE `storyteller_assistant_memories`;
