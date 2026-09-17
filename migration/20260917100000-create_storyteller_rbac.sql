-- +migrate Up
CREATE TABLE `storyteller_roles` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `scope_type` VARCHAR(16) NOT NULL COMMENT 'project, platform',
    `project_id` BIGINT UNSIGNED NULL COMMENT 'NULL for platform-scoped roles',
    `created_by_user_id` BIGINT UNSIGNED NOT NULL COMMENT 'storyteller_users.id, no FK per user-decoupling convention',
    `disabled_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_storyteller_roles_project` (`project_id`),
    KEY `idx_storyteller_roles_scope` (`scope_type`),
    CONSTRAINT `fk_storyteller_roles_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_permissions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(64) NOT NULL COMMENT 'e.g. story.read; defined by code/migration only, not user-created',
    `scope_type` VARCHAR(16) NOT NULL COMMENT 'project, platform',
    `description` VARCHAR(255) NOT NULL DEFAULT '',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_storyteller_permissions_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_role_permissions` (
    `role_id` BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`role_id`, `permission_id`),
    KEY `idx_storyteller_role_permissions_permission` (`permission_id`),
    CONSTRAINT `fk_storyteller_role_permissions_role`
        FOREIGN KEY (`role_id`) REFERENCES `storyteller_roles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_storyteller_role_permissions_permission`
        FOREIGN KEY (`permission_id`) REFERENCES `storyteller_permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_user_roles` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `role_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT 'storyteller_users.id, no FK per user-decoupling convention',
    `starts_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NULL DEFAULT NULL,
    `granted_by_user_id` BIGINT UNSIGNED NOT NULL COMMENT 'always the project owner in the first batch; role/member management is owner-only, this column is audit metadata, not a delegation mechanism',
    `revoked_at` TIMESTAMP NULL DEFAULT NULL,
    `revoked_by_user_id` BIGINT UNSIGNED NULL COMMENT 'same owner-only caveat as granted_by_user_id',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_storyteller_user_roles_role` (`role_id`),
    KEY `idx_storyteller_user_roles_effective` (`user_id`, `revoked_at`, `starts_at`, `expires_at`),
    CONSTRAINT `fk_storyteller_user_roles_role`
        FOREIGN KEY (`role_id`) REFERENCES `storyteller_roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `storyteller_project_audits` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `project_id` BIGINT UNSIGNED NOT NULL,
    `actor_user_id` BIGINT UNSIGNED NOT NULL COMMENT 'storyteller_users.id, no FK per user-decoupling convention',
    `source` VARCHAR(16) NOT NULL COMMENT 'web, mcp, admin',
    `action` VARCHAR(64) NOT NULL COMMENT 'e.g. project.update, role.grant, role.revoke',
    `target_type` VARCHAR(32) NOT NULL COMMENT 'project, story, volume, lore, lore_collection, asset_collection, asset, role, user_role',
    `target_id` VARCHAR(64) NULL COMMENT 'target public_id, or numeric id as string when the target has no public_id',
    `summary` JSON NULL COMMENT 'safe before/after field diff; never store tokens, API keys or full content',
    `request_id` VARCHAR(64) NULL,
    `occurred_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_storyteller_project_audits_project_time` (`project_id`, `occurred_at`),
    KEY `idx_storyteller_project_audits_actor` (`actor_user_id`),
    CONSTRAINT `fk_storyteller_project_audits_project`
        FOREIGN KEY (`project_id`) REFERENCES `storyteller_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 第一批 project-scope permission key，只由 migration 定義，不開放使用者自訂 key。
INSERT INTO `storyteller_permissions` (`key`, `scope_type`, `description`) VALUES
    ('project.read', 'project', 'Read project metadata (safe summary)'),
    ('project.update', 'project', 'Update project metadata (name, description, visibility, rating, content type, tags)'),
    ('story.create', 'project', 'Create a story or image episode'),
    ('story.read', 'project', 'Read a story or image episode'),
    ('story.update', 'project', 'Update a story or image episode'),
    ('volume.create', 'project', 'Create a volume'),
    ('volume.read', 'project', 'Read a volume'),
    ('volume.update', 'project', 'Update a volume'),
    ('lore.create', 'project', 'Create a lore entry'),
    ('lore.read', 'project', 'Read a lore entry'),
    ('lore.update', 'project', 'Update a lore entry'),
    ('lore_collection.create', 'project', 'Create a lore collection'),
    ('lore_collection.read', 'project', 'Read a lore collection'),
    ('lore_collection.update', 'project', 'Update a lore collection'),
    ('asset_collection.create', 'project', 'Create an asset collection'),
    ('asset_collection.read', 'project', 'Read an asset collection'),
    ('asset_collection.update', 'project', 'Update an asset collection'),
    ('asset.create', 'project', 'Create/upload an asset'),
    ('asset.read', 'project', 'Read an asset'),
    ('asset.update', 'project', 'Update an asset (metadata, replace file, move)');

-- +migrate Down
DROP TABLE `storyteller_project_audits`;
DROP TABLE `storyteller_user_roles`;
DROP TABLE `storyteller_role_permissions`;
DROP TABLE `storyteller_permissions`;
DROP TABLE `storyteller_roles`;
