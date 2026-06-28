-- +migrate Up
ALTER TABLE `storyteller_projects`
    ADD COLUMN `rating` VARCHAR(32) NOT NULL DEFAULT 'general' COMMENT 'general, guidance, restricted' AFTER `visibility`,
    ADD COLUMN `tags` JSON NULL AFTER `rating`,
    ADD KEY `idx_storyteller_projects_rating` (`rating`);

ALTER TABLE `storyteller_stories`
    ADD COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'completed' COMMENT 'draft, completed' AFTER `summary`,
    ADD KEY `idx_storyteller_stories_project_status_sort` (`project_id`, `status`, `sort`);

-- +migrate Down
ALTER TABLE `storyteller_stories`
    DROP KEY `idx_storyteller_stories_project_status_sort`,
    DROP COLUMN `status`;

ALTER TABLE `storyteller_projects`
    DROP KEY `idx_storyteller_projects_rating`,
    DROP COLUMN `tags`,
    DROP COLUMN `rating`;
