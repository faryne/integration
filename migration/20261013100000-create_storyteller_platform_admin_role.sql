-- +migrate Up
-- 平台（管理後台）權限：命名 admin.<resource>.<action>，與 project scope 的權限分開檢查、不互相推導
INSERT INTO `storyteller_permissions` (`key`, `scope_type`, `description`) VALUES
    ('admin.report.read', 'platform', 'Read reports and the reported content'),
    ('admin.report.update', 'platform', 'Resolve or dismiss reports'),
    ('admin.comment.delete', 'platform', 'Remove a comment as moderator'),
    ('admin.author_post.delete', 'platform', 'Remove an author post as moderator'),
    ('admin.discussion_thread.delete', 'platform', 'Remove a discussion thread as moderator'),
    ('admin.story.delete', 'platform', 'Remove an episode as moderator (volumes excluded)'),
    ('admin.lore.delete', 'platform', 'Remove a lore entry as moderator'),
    ('admin.project.delete', 'platform', 'Remove a whole project as moderator'),
    ('admin.author_profile.delete', 'platform', 'Remove an extra pen name with its posts, threads and comments'),
    ('admin.user.ban', 'platform', 'Ban an account (blocks sign-in, sessions, PAT and OAuth)');

-- 平台角色 admin：建立者與第一位成員都是主站 users.id = 1 對應的 Storyteller 帳號
-- （storyteller_user_roles.user_id 存的是 storyteller_users.id，所以用 storyteller_users.user_id 對應出來，不寫死）
INSERT INTO `storyteller_roles` (`name`, `scope_type`, `project_id`, `created_by_user_id`)
SELECT 'admin', 'platform', NULL, COALESCE((SELECT `id` FROM `storyteller_users` WHERE `user_id` = 1 LIMIT 1), 0);

INSERT INTO `storyteller_role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `storyteller_roles` r
JOIN `storyteller_permissions` p ON p.`scope_type` = 'platform' AND p.`key` LIKE 'admin.%'
WHERE r.`name` = 'admin' AND r.`scope_type` = 'platform' AND r.`project_id` IS NULL;

INSERT INTO `storyteller_user_roles` (`role_id`, `user_id`, `granted_by_user_id`)
SELECT r.`id`, u.`id`, u.`id`
FROM `storyteller_roles` r
JOIN `storyteller_users` u ON u.`user_id` = 1
WHERE r.`name` = 'admin' AND r.`scope_type` = 'platform' AND r.`project_id` IS NULL;

-- +migrate Down
-- role 刪除會連帶刪掉 role_permissions／user_roles（FK ON DELETE CASCADE）
DELETE FROM `storyteller_roles` WHERE `name` = 'admin' AND `scope_type` = 'platform' AND `project_id` IS NULL;
DELETE FROM `storyteller_permissions` WHERE `scope_type` = 'platform' AND `key` LIKE 'admin.%';
