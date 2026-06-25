-- +migrate Up
ALTER TABLE `storyteller_story_chat_messages`
    ADD COLUMN `agent_id` BIGINT UNSIGNED NULL AFTER `chat_id`,
    ADD KEY `idx_storyteller_story_chat_messages_agent` (`agent_id`),
    ADD CONSTRAINT `fk_storyteller_story_chat_messages_agent`
        FOREIGN KEY (`agent_id`) REFERENCES `storyteller_agents` (`id`) ON DELETE SET NULL;

UPDATE `storyteller_story_chat_messages` AS messages
INNER JOIN `storyteller_story_chats` AS chats ON chats.id = messages.chat_id
SET messages.agent_id = chats.agent_id
WHERE messages.agent_id IS NULL;

-- +migrate Down
ALTER TABLE `storyteller_story_chat_messages`
    DROP FOREIGN KEY `fk_storyteller_story_chat_messages_agent`,
    DROP KEY `idx_storyteller_story_chat_messages_agent`,
    DROP COLUMN `agent_id`;
